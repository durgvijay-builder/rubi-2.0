import { Page, Route } from '@playwright/test';
import {
  DEFAULT_WORKSPACE,
  FOREIGN_WORKSPACE,
  MOCK_EXTRACTIONS,
  ExtractedBatchPayload,
  ExtractedTaskPayload,
  TaskRecordPayload,
  ActivityEventPayload,
} from '../fixtures/mock-payloads.js';
import { SYNTHETIC_CHIME_WAV } from '../fixtures/audio-tones.js';

/**
 * In-memory Mock State Store for E2E offline test execution.
 */
export class MockNetworkState {
  public workspaceId: string = DEFAULT_WORKSPACE.id;
  public tasks: Map<string, TaskRecordPayload> = new Map();
  public activities: ActivityEventPayload[] = new ActivityEventPayloadList();
  public stagedExtraction: ExtractedBatchPayload | null = null;
  public lastSTTTranscript: string = '';
  public lastTTSSpokenText: string = '';

  constructor() {
    this.reset();
  }

  reset() {
    this.workspaceId = DEFAULT_WORKSPACE.id;
    this.tasks.clear();
    this.activities.length = 0;
    this.stagedExtraction = null;
    this.lastSTTTranscript = '';
    this.lastTTSSpokenText = '';

    // Seed default baseline tasks
    this.addTask({
      id: 'task-seed-1',
      workspaceId: DEFAULT_WORKSPACE.id,
      title: 'Initialize repository structure',
      description: 'Setup monorepo and packages',
      status: 'COMPLETED',
      priority: 'HIGH',
      assignee: 'Durgvijay',
      deadline: '2026-11-06T18:00:00.000Z',
      isArchived: false,
      createdAt: '2026-11-06T10:00:00.000Z',
      updatedAt: '2026-11-06T12:00:00.000Z',
    });

    this.addTask({
      id: 'task-seed-2',
      workspaceId: DEFAULT_WORKSPACE.id,
      title: 'Review legacy database models',
      description: 'Audit SQLite and Supabase schema',
      status: 'TO_DO',
      priority: 'MEDIUM',
      assignee: 'Sarah',
      deadline: '2026-11-09T17:00:00.000Z',
      isArchived: false,
      createdAt: '2026-11-06T11:00:00.000Z',
      updatedAt: '2026-11-06T11:00:00.000Z',
    });

    this.addTask({
      id: 'task-seed-3',
      workspaceId: DEFAULT_WORKSPACE.id,
      title: 'Deploy native PostgreSQL 18.6 container',
      description: 'Run native postgres on port 5432',
      status: 'TO_DO',
      priority: 'HIGH',
      assignee: 'Alex',
      deadline: '2026-11-10T12:00:00.000Z',
      isArchived: false,
      createdAt: '2026-11-07T08:00:00.000Z',
      updatedAt: '2026-11-07T08:00:00.000Z',
    });
  }

  addTask(task: TaskRecordPayload) {
    this.tasks.set(task.id, task);
  }

  logActivity(
    eventType: ActivityEventPayload['eventType'],
    taskId: string | null,
    previousState?: Record<string, unknown> | null,
    newState?: Record<string, unknown> | null,
    metadata?: Record<string, unknown> | null
  ) {
    const event: ActivityEventPayload = {
      id: `activity-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      workspaceId: this.workspaceId,
      taskId,
      actorId: 'user-durgvijay-001',
      actorType: 'USER',
      eventType,
      previousState: previousState || null,
      newState: newState || null,
      metadata: metadata || null,
      createdAt: new Date().toISOString(),
    };
    this.activities.unshift(event); // newest first
    return event;
  }
}

class ActivityEventPayloadList extends Array<ActivityEventPayload> {}

/**
 * Registers all network interceptors for R.U.B.I. 2.0 API routes.
 */
export async function setupMockNetworkRoutes(page: Page, state: MockNetworkState) {
  // Reset standalone mock server before each test execution
  await page.request.post('/api/test/reset').catch(() => {});

  // If live API or standalone mock server is handling HTTP requests directly,
  // pass through so browser UI and page.request operate on the exact same database state.
  if (process.env.USE_LIVE_API === 'true' || !process.env.FORCE_CLIENT_ROUTE_INTERCEPTION) {
    return;
  }

  // Intercept all API routes
  await page.route(/\/api\/.*/, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const pathname = url.pathname;
    const headers = request.headers();

    // 1. Workspace Authorization Check
    const reqWorkspaceId = headers['x-workspace-id'] || DEFAULT_WORKSPACE.id;
    if (reqWorkspaceId === FOREIGN_WORKSPACE.id || pathname.includes('/forbidden-workspace')) {
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Forbidden',
          message: 'Unauthorized workspace access: cross-workspace query rejected.',
          workspaceId: reqWorkspaceId,
        }),
      });
    }

    // 2. STT Speech-to-Text: /api/speech/transcribe or /api/transcribe
    if ((pathname.endsWith('/speech/transcribe') || pathname.endsWith('/transcribe')) && method === 'POST') {
      const contentType = headers['content-type'] || '';
      const contentLength = parseInt(headers['content-length'] || '0', 10);

      // Check payload size boundary (> 25MB)
      if (contentLength > 25 * 1024 * 1024) {
        return route.fulfill({
          status: 413,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Payload Too Large',
            message: 'Audio file exceeds the maximum allowed size of 25MB.',
          }),
        });
      }

      // Check unsupported file type boundary
      if (headers['x-file-type'] === 'unsupported' || contentType.includes('application/pdf')) {
        return route.fulfill({
          status: 415,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Unsupported Media Type',
            message: 'Only WAV, MP3, WebM, and OGG audio formats are supported.',
          }),
        });
      }

      // Check simulated empty audio
      if (headers['x-simulate-empty'] === 'true') {
        state.lastSTTTranscript = '';
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            transcript: '',
            text: '',
            confidence: 0.0,
            languageDetected: 'indic-auto',
            durationSeconds: 0,
            isMock: true,
            warning: 'No speech detected.',
          }),
        });
      }

      // Read audio body or test transcript header override
      let transcript =
        headers['x-mock-transcript'] ||
        'Kal subah 10 baje sprint planning meeting karni hai aur Durgvijay ko architecture document complete karna hai before Friday. Frontend dashboard integration blocked hai backend API se.';
      state.lastSTTTranscript = decodeURIComponent(transcript);

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          transcript: state.lastSTTTranscript,
          text: state.lastSTTTranscript,
          confidence: 0.96,
          languageDetected: 'hi-en',
          durationSeconds: 4.8,
          isMock: true,
        }),
      });
    }

    // 3. TTS Text-to-Speech: /api/speech/synthesize or /api/tts
    if ((pathname.endsWith('/speech/synthesize') || pathname.endsWith('/tts')) && method === 'POST') {
      let postData: any = {};
      try {
        postData = request.postDataJSON() || {};
      } catch {
        postData = {};
      }

      const text = postData.text || 'Task approved and persisted to backlog.';
      state.lastTTSSpokenText = text;

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          audioBase64: SYNTHETIC_CHIME_WAV.toString('base64'),
          mimeType: 'audio/wav',
          durationMs: 1500,
          durationSeconds: 1.5,
          spokenText: text,
          voiceUsed: postData.voice || 'Shivani',
          isMock: true,
        }),
      });
    }

    // 4. Semantic Extraction & Intent Router: /api/extract or /api/ai/extract
    if ((pathname.endsWith('/extract') || pathname.endsWith('/ai/extract')) && method === 'POST') {
      let postData: any = {};
      try {
        postData = request.postDataJSON() || {};
      } catch {
        postData = {};
      }

      const transcript = postData.transcript || state.lastSTTTranscript || '';

      // Check Deterministic Intent Router Patterns (Zero-Token Bypass)
      const completeRegex = /(?:mark|set)\s+(?:task\s+)?#?(\w+)\s+(?:as\s+)?(done|completed)|(?:task\s+)?#?(\w+)\s+ko\s+(done|complete)\s+kar\s+do/i;
      const listRegex = /(?:show|list|get|read)\s+(?:all\s+)?(?:pending\s+)?(?:tasks|backlog)|pending\s+tasks?\s+batao/i;

      const matchComplete = transcript.match(completeRegex);
      if (matchComplete) {
        const taskIdStr = matchComplete[1] || matchComplete[3] || '3';
        const targetTaskId = taskIdStr.startsWith('task-') ? taskIdStr : `task-seed-${taskIdStr}`;
        const existingTask = state.tasks.get(targetTaskId);

        if (existingTask) {
          const prevStatus = existingTask.status;
          existingTask.status = 'COMPLETED';
          existingTask.updatedAt = new Date().toISOString();
          state.logActivity('TASK_STATUS_CHANGED', existingTask.id, { status: prevStatus }, { status: 'COMPLETED' }, { bypassLLM: true });
        }

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            bypassLLM: true,
            intent: 'MARK_COMPLETED',
            message: `Task #${taskIdStr} successfully marked as completed without LLM invocation.`,
            affectedTaskId: targetTaskId,
            tokensUsed: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
          }),
        });
      }

      if (transcript.match(listRegex)) {
        const pendingTasks = Array.from(state.tasks.values()).filter((t) => !t.isArchived);
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            bypassLLM: true,
            intent: 'LIST_TASKS',
            tasks: pendingTasks,
            tokensUsed: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
          }),
        });
      }

      // Check Circular Dependency Test Case
      if (transcript.toLowerCase().includes('task alpha') || transcript.includes('circular')) {
        const circularBatch = JSON.parse(JSON.stringify(MOCK_EXTRACTIONS.CIRCULAR_DEPENDENCY_CYCLE!));
        state.stagedExtraction = circularBatch;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...circularBatch,
            hasCycle: true,
            cycleNodes: ['Task Alpha', 'Task Beta'],
            errorMessage: 'Circular dependency detected: Task Alpha cannot depend on Task Beta while Task Beta depends on Task Alpha.',
          }),
        });
      }

      // Check Ambiguous Unassigned Case
      if (transcript.toLowerCase().includes('as soon as possible') || transcript.toLowerCase().includes('isko jaldi se')) {
        const ambigBatch = JSON.parse(JSON.stringify(MOCK_EXTRACTIONS.AMBIGUOUS_NO_ASSIGNEE!));
        state.stagedExtraction = ambigBatch;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(ambigBatch),
        });
      }

      // Check Self-Referencing Dependency Case
      if (transcript.toLowerCase().includes('task gamma') || transcript.toLowerCase().includes('self')) {
        const selfBatch = {
          summary: 'Task Gamma with self-dependency stripped.',
          tasks: [
            {
              tempId: 'task-temp-gamma',
              title: 'Task Gamma',
              description: 'Self-referencing dependency was stripped by Zod refinement',
              owner: 'Dev Gamma',
              priority: 'MEDIUM' as const,
              deadline: null,
              dependencies: [],
              status: 'PENDING_APPROVAL' as const,
              ambiguities: ['Self-referencing dependency was automatically removed'],
            },
          ],
          ambiguities: ['Self-referencing dependency detected on Task Gamma and removed.'],
          tokensUsed: { promptTokens: 180, completionTokens: 80, totalTokens: 260, estimatedCostUsd: 0.0000375 },
        };
        state.stagedExtraction = selfBatch;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(selfBatch),
        });
      }

      // Check English Database Pipeline Case
      if (transcript.toLowerCase().includes('postgresql database')) {
        const enBatch = JSON.parse(JSON.stringify(MOCK_EXTRACTIONS.EN_DATABASE_PIPELINE!));
        state.stagedExtraction = enBatch;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(enBatch),
        });
      }

      // Default: Multi-task Hinglish Meeting
      const defaultBatch = JSON.parse(JSON.stringify(MOCK_EXTRACTIONS.HINGLISH_SPRINT_MEETING!));
      state.stagedExtraction = defaultBatch;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(defaultBatch),
      });
    }

    // 5. Task List / Query: GET /api/tasks
    if (pathname === '/api/tasks' && method === 'GET') {
      const showArchived = url.searchParams.get('archived') === 'true';
      const allTasks = Array.from(state.tasks.values()).filter((t) =>
        showArchived ? t.isArchived : !t.isArchived
      );
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tasks: allTasks, total: allTasks.length }),
      });
    }

    // 6. Task Approval & Persistence: POST /api/tasks/approve-all or POST /api/tasks
    if (
      (pathname === '/api/tasks/approve-all' || pathname === '/api/tasks/approve' || pathname === '/api/tasks') &&
      method === 'POST'
    ) {
      let postData: any = {};
      try {
        postData = request.postDataJSON() || {};
      } catch {
        postData = {};
      }

      const tasksToPersist: ExtractedTaskPayload[] = postData.tasks || state.stagedExtraction?.tasks || [];

      // Check if any task in batch has a circular dependency
      if (tasksToPersist.some((t) => t.cycleError)) {
        return route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Unprocessable Entity',
            message: 'Cannot commit batch: circular dependency unresolved.',
          }),
        });
      }

      const createdTasks: TaskRecordPayload[] = [];
      const tempIdToRealIdMap = new Map<string, string>();

      // Generate IDs
      for (const t of tasksToPersist) {
        const realId = `task-approved-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        tempIdToRealIdMap.set(t.tempId, realId);
      }

      for (const t of tasksToPersist) {
        const realId = tempIdToRealIdMap.get(t.tempId)!;
        const realDeps = (t.dependencies || []).map((depTempId) => tempIdToRealIdMap.get(depTempId) || depTempId);

        // Determine initial status: If it has blocking dependencies, it becomes BLOCKED; otherwise TO_DO
        const initialStatus = realDeps.length > 0 ? 'BLOCKED' : 'TO_DO';

        const record: TaskRecordPayload = {
          id: realId,
          workspaceId: state.workspaceId,
          title: t.title,
          description: t.description || null,
          status: initialStatus,
          priority: t.priority || 'MEDIUM',
          assignee: t.owner || t.assignee || null,
          deadline: t.deadline || null,
          isArchived: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          dependencies: realDeps,
        };

        state.addTask(record);
        createdTasks.push(record);

        state.logActivity('TASK_CREATED', record.id, null, { title: record.title, status: record.status });
        state.logActivity('TASK_APPROVED', record.id, { status: 'PENDING_APPROVAL' }, { status: record.status });
        if (realDeps.length > 0) {
          state.logActivity('DEPENDENCY_ADDED', record.id, null, { blockedBy: realDeps });
        }
      }

      // Clear staged extraction
      state.stagedExtraction = null;

      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          tasks: createdTasks,
          message: `Successfully approved and persisted ${createdTasks.length} tasks.`,
        }),
      });
    }

    // 7. Single Task Mutate / Update / Status Change: PATCH /api/tasks/:id
    const taskMatch = pathname.match(/\/api\/tasks\/([^/]+)$/);
    if (taskMatch && (method === 'PATCH' || method === 'PUT')) {
      const taskId = taskMatch[1]!;
      const existingTask = state.tasks.get(taskId);

      if (!existingTask) {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Not Found', message: `Task ${taskId} not found.` }),
        });
      }

      let patchData: any = {};
      try {
        patchData = request.postDataJSON() || {};
      } catch {
        patchData = {};
      }

      const prev = { ...existingTask };

      if (patchData.status && patchData.status !== existingTask.status) {
        existingTask.status = patchData.status;
        state.logActivity('TASK_STATUS_CHANGED', taskId, { status: prev.status }, { status: patchData.status });

        // If completed, automatically unblock dependent tasks
        if (patchData.status === 'COMPLETED') {
          for (const otherTask of state.tasks.values()) {
            if (otherTask.dependencies && otherTask.dependencies.includes(taskId) && otherTask.status === 'BLOCKED') {
              // Check if all dependencies of otherTask are completed
              const allMet = otherTask.dependencies.every((dId) => state.tasks.get(dId)?.status === 'COMPLETED');
              if (allMet) {
                const prevOtherStatus = otherTask.status;
                otherTask.status = 'TO_DO';
                otherTask.updatedAt = new Date().toISOString();
                state.logActivity(
                  'TASK_STATUS_CHANGED',
                  otherTask.id,
                  { status: prevOtherStatus },
                  { status: 'TO_DO' },
                  { reason: `Prerequisite ${taskId} completed` }
                );
              }
            }
          }
        }
      }

      if (patchData.title) existingTask.title = patchData.title;
      if (patchData.assignee !== undefined) existingTask.assignee = patchData.assignee;
      if (patchData.priority) existingTask.priority = patchData.priority;
      if (patchData.deadline !== undefined) existingTask.deadline = patchData.deadline;

      if (patchData.isArchived !== undefined && patchData.isArchived !== existingTask.isArchived) {
        existingTask.isArchived = patchData.isArchived;
        state.logActivity(
          patchData.isArchived ? 'TASK_ARCHIVED' : 'TASK_RESTORED',
          taskId,
          { isArchived: prev.isArchived },
          { isArchived: patchData.isArchived }
        );
      }

      existingTask.updatedAt = new Date().toISOString();

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, task: existingTask }),
      });
    }

    // 8. Immutable Activity Timeline: GET /api/activities
    if (pathname === '/api/activities' && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          activities: state.activities,
          total: state.activities.length,
        }),
      });
    }

    // 9. Workspace info: GET /api/workspace
    if (pathname === '/api/workspace' && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          workspace: DEFAULT_WORKSPACE,
          currentUser: { id: 'user-durgvijay-001', name: 'Durgvijay Chauhan', role: 'ADMIN' },
        }),
      });
    }

    // Default fallback: pass through or 404
    return route.continue();
  });
}
