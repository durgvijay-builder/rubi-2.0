import http from 'node:http';
import { URL } from 'node:url';
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
 * Standalone mock HTTP server for offline Playwright E2E execution.
 * Serves both the interactive HTML test harness and full mock API routes.
 */
export class StandaloneMockServer {
  private server: http.Server | null = null;
  public port: number = 5173;
  public workspaceId: string = DEFAULT_WORKSPACE.id;
  public tasks: Map<string, TaskRecordPayload> = new Map();
  public activities: ActivityEventPayload[] = [];
  public stagedExtraction: ExtractedBatchPayload | null = null;
  public lastSTTTranscript: string = '';
  public lastTTSSpokenText: string = '';

  constructor(port: number = 5173) {
    this.port = port;
    this.resetState();
  }

  resetState() {
    this.workspaceId = DEFAULT_WORKSPACE.id;
    this.tasks.clear();
    this.activities = [];
    this.stagedExtraction = null;
    this.lastSTTTranscript = '';
    this.lastTTSSpokenText = '';

    // Baseline Seeded Tasks
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
    this.activities.unshift(event);
    return event;
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = http.createServer(async (req, res) => {
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        const pathname = parsedUrl.pathname;
        const method = req.method || 'GET';
        const headers = req.headers;

        // Collect body buffer
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
        const bodyBuffer = Buffer.concat(chunks);
        let jsonBody: any = {};
        if (bodyBuffer.length > 0) {
          try {
            jsonBody = JSON.parse(bodyBuffer.toString('utf8'));
          } catch {
            jsonBody = {};
          }
        }

        // 0. Test State Reset Route
        if (pathname === '/api/test/reset' && method === 'POST') {
          this.resetState();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'State reset to baseline' }));
          return;
        }

        // 1. Workspace Isolation
        const reqWorkspaceId = (headers['x-workspace-id'] as string) || DEFAULT_WORKSPACE.id;
        if (reqWorkspaceId === FOREIGN_WORKSPACE.id || pathname.includes('/forbidden-workspace')) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'Forbidden',
              message: 'Unauthorized workspace access: cross-workspace query rejected.',
              workspaceId: reqWorkspaceId,
            })
          );
          return;
        }

        // 2. STT Route
        if ((pathname.endsWith('/speech/transcribe') || pathname.endsWith('/transcribe')) && method === 'POST') {
          const contentType = (headers['content-type'] as string) || '';
          const contentLength = parseInt((headers['content-length'] as string) || bodyBuffer.length.toString(), 10);

          if (contentLength > 25 * 1024 * 1024 || bodyBuffer.length > 25 * 1024 * 1024) {
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: 'Payload Too Large',
                message: 'Audio file exceeds the maximum allowed size of 25MB.',
              })
            );
            return;
          }

          if (headers['x-file-type'] === 'unsupported' || contentType.includes('application/pdf')) {
            res.writeHead(415, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: 'Unsupported Media Type',
                message: 'Only WAV, MP3, WebM, and OGG audio formats are supported.',
              })
            );
            return;
          }

          if (headers['x-simulate-empty'] === 'true') {
            this.lastSTTTranscript = '';
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                transcript: '',
                text: '',
                confidence: 0.0,
                languageDetected: 'indic-auto',
                durationSeconds: 0,
                isMock: true,
                warning: 'No speech detected.',
              })
            );
            return;
          }

          let transcript =
            (headers['x-mock-transcript'] as string) ||
            'Kal subah 10 baje sprint planning meeting karni hai aur Durgvijay ko architecture document complete karna hai before Friday. Frontend dashboard integration blocked hai backend API se.';
          this.lastSTTTranscript = decodeURIComponent(transcript);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              transcript: this.lastSTTTranscript,
              text: this.lastSTTTranscript,
              confidence: 0.96,
              languageDetected: 'hi-en',
              durationSeconds: 4.8,
              isMock: true,
            })
          );
          return;
        }

        // 3. TTS Route
        if ((pathname.endsWith('/speech/synthesize') || pathname.endsWith('/tts')) && method === 'POST') {
          const text = jsonBody.text || 'Task approved and persisted to backlog.';
          this.lastTTSSpokenText = text;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              audioBase64: SYNTHETIC_CHIME_WAV.toString('base64'),
              mimeType: 'audio/wav',
              durationMs: 1500,
              durationSeconds: 1.5,
              spokenText: text,
              voiceUsed: jsonBody.voice || 'Shivani',
              isMock: true,
            })
          );
          return;
        }

        // 4. Extraction & Intent Router
        if ((pathname.endsWith('/extract') || pathname.endsWith('/ai/extract')) && method === 'POST') {
          const transcript = jsonBody.transcript || this.lastSTTTranscript || '';

          const completeRegex = /(?:mark|set)\s+(?:task\s+)?#?(\w+)\s+(?:as\s+)?(done|completed)|(?:task\s+)?#?(\w+)\s+ko\s+(done|complete)\s+kar\s+do/i;
          const listRegex = /(?:show|list|get|read)\s+(?:all\s+)?(?:pending\s+)?(?:tasks|backlog)|pending\s+tasks?\s+batao/i;

          const matchComplete = transcript.match(completeRegex);
          if (matchComplete) {
            const taskIdStr = matchComplete[1] || matchComplete[3] || '3';
            const targetTaskId = taskIdStr.startsWith('task-') ? taskIdStr : `task-seed-${taskIdStr}`;
            const existingTask = this.tasks.get(targetTaskId);

            if (existingTask) {
              const prevStatus = existingTask.status;
              existingTask.status = 'COMPLETED';
              existingTask.updatedAt = new Date().toISOString();
              this.logActivity('TASK_STATUS_CHANGED', existingTask.id, { status: prevStatus }, { status: 'COMPLETED' }, { bypassLLM: true });
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                bypassLLM: true,
                intent: 'MARK_COMPLETED',
                message: `Task #${taskIdStr} successfully marked as completed without LLM invocation.`,
                affectedTaskId: targetTaskId,
                tokensUsed: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
              })
            );
            return;
          }

          if (transcript.match(listRegex)) {
            const pendingTasks = Array.from(this.tasks.values()).filter((t) => !t.isArchived);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                bypassLLM: true,
                intent: 'LIST_TASKS',
                tasks: pendingTasks,
                tokensUsed: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
              })
            );
            return;
          }

          if (transcript.toLowerCase().includes('task alpha') || transcript.includes('circular')) {
            const circularBatch = JSON.parse(JSON.stringify(MOCK_EXTRACTIONS.CIRCULAR_DEPENDENCY_CYCLE!));
            this.stagedExtraction = circularBatch;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                ...circularBatch,
                hasCycle: true,
                cycleNodes: ['Task Alpha', 'Task Beta'],
                errorMessage: 'Circular dependency detected: Task Alpha cannot depend on Task Beta while Task Beta depends on Task Alpha.',
              })
            );
            return;
          }

          if (transcript.toLowerCase().includes('as soon as possible') || transcript.toLowerCase().includes('isko jaldi se')) {
            const ambigBatch = JSON.parse(JSON.stringify(MOCK_EXTRACTIONS.AMBIGUOUS_NO_ASSIGNEE!));
            this.stagedExtraction = ambigBatch;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(ambigBatch));
            return;
          }

          if (transcript.toLowerCase().includes('task gamma') || transcript.toLowerCase().includes('self')) {
            const selfBatch = {
              summary: 'Task Gamma with self-dependency stripped.',
              tasks: [
                {
                  tempId: 'task-temp-gamma',
                  title: 'Task Gamma',
                  description: 'Self-referencing dependency was stripped by Zod refinement',
                  owner: 'Dev Gamma',
                  priority: 'MEDIUM',
                  deadline: null,
                  dependencies: [],
                  status: 'PENDING_APPROVAL',
                  ambiguities: ['Self-referencing dependency was automatically removed'],
                },
              ],
              ambiguities: ['Self-referencing dependency detected on Task Gamma and removed.'],
              tokensUsed: { promptTokens: 180, completionTokens: 80, totalTokens: 260, estimatedCostUsd: 0.0000375 },
            };
            this.stagedExtraction = selfBatch as any;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(selfBatch));
            return;
          }

          if (transcript.toLowerCase().includes('retrospective') || transcript.toLowerCase().includes('sarah')) {
            const singleBatch = {
              summary: 'Team retrospective meeting scheduled for Friday.',
              tasks: [
                {
                  tempId: 'task-temp-retro',
                  title: 'Schedule team retrospective meeting',
                  description: 'Friday at 4 PM retro',
                  owner: 'Sarah',
                  priority: 'MEDIUM',
                  deadline: '2026-11-13T16:00:00.000Z',
                  dependencies: [],
                  status: 'PENDING_APPROVAL',
                },
              ],
              ambiguities: [],
              tokensUsed: { promptTokens: 120, completionTokens: 60, totalTokens: 180, estimatedCostUsd: 0.000027 },
            };
            this.stagedExtraction = singleBatch as any;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(singleBatch));
            return;
          }

          if (transcript.toLowerCase().includes('postgresql database')) {
            const enBatch = JSON.parse(JSON.stringify(MOCK_EXTRACTIONS.EN_DATABASE_PIPELINE!));
            this.stagedExtraction = enBatch;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(enBatch));
            return;
          }

          const defaultBatch = JSON.parse(JSON.stringify(MOCK_EXTRACTIONS.HINGLISH_SPRINT_MEETING!));
          this.stagedExtraction = defaultBatch;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(defaultBatch));
          return;
        }

        // 5. Tasks GET
        if (pathname === '/api/tasks' && method === 'GET') {
          const showArchived = parsedUrl.searchParams.get('archived') === 'true';
          const allTasks = Array.from(this.tasks.values()).filter((t) =>
            showArchived ? t.isArchived : !t.isArchived
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ tasks: allTasks, total: allTasks.length }));
          return;
        }

        // 6. Tasks POST (Approve all / approve)
        if (
          (pathname === '/api/tasks/approve-all' || pathname === '/api/tasks/approve' || pathname === '/api/tasks') &&
          method === 'POST'
        ) {
          const tasksToPersist: ExtractedTaskPayload[] = jsonBody.tasks || this.stagedExtraction?.tasks || [];

          if (tasksToPersist.some((t) => t.cycleError)) {
            res.writeHead(422, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: 'Unprocessable Entity',
                message: 'Cannot commit batch: circular dependency unresolved.',
              })
            );
            return;
          }

          const createdTasks: TaskRecordPayload[] = [];
          const tempIdToRealIdMap = new Map<string, string>();

          for (const t of tasksToPersist) {
            const realId = `task-approved-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            tempIdToRealIdMap.set(t.tempId, realId);
          }

          for (const t of tasksToPersist) {
            const realId = tempIdToRealIdMap.get(t.tempId)!;
            const realDeps = (t.dependencies || []).map((depTempId) => tempIdToRealIdMap.get(depTempId) || depTempId);
            const initialStatus = realDeps.length > 0 ? 'BLOCKED' : 'TO_DO';

            const record: TaskRecordPayload = {
              id: realId,
              workspaceId: this.workspaceId,
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

            this.addTask(record);
            createdTasks.push(record);

            this.logActivity('TASK_CREATED', record.id, null, { title: record.title, status: record.status });
            this.logActivity('TASK_APPROVED', record.id, { status: 'PENDING_APPROVAL' }, { status: record.status });
            if (realDeps.length > 0) {
              this.logActivity('DEPENDENCY_ADDED', record.id, null, { blockedBy: realDeps });
            }
          }

          this.stagedExtraction = null;

          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              tasks: createdTasks,
              message: `Successfully approved and persisted ${createdTasks.length} tasks.`,
            })
          );
          return;
        }

        // 7. Tasks PATCH
        const taskMatch = pathname.match(/\/api\/tasks\/([^/]+)$/);
        if (taskMatch && (method === 'PATCH' || method === 'PUT')) {
          const taskId = taskMatch[1]!;
          const existingTask = this.tasks.get(taskId);

          if (!existingTask) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not Found', message: `Task ${taskId} not found.` }));
            return;
          }

          const prev = { ...existingTask };

          if (jsonBody.status && jsonBody.status !== existingTask.status) {
            existingTask.status = jsonBody.status;
            this.logActivity('TASK_STATUS_CHANGED', taskId, { status: prev.status }, { status: jsonBody.status });

            if (jsonBody.status === 'COMPLETED') {
              for (const otherTask of this.tasks.values()) {
                if (otherTask.dependencies && otherTask.dependencies.includes(taskId) && otherTask.status === 'BLOCKED') {
                  const allMet = otherTask.dependencies.every((dId) => this.tasks.get(dId)?.status === 'COMPLETED');
                  if (allMet) {
                    const prevOtherStatus = otherTask.status;
                    otherTask.status = 'TO_DO';
                    otherTask.updatedAt = new Date().toISOString();
                    this.logActivity(
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

          if (jsonBody.title) existingTask.title = jsonBody.title;
          if (jsonBody.assignee !== undefined) existingTask.assignee = jsonBody.assignee;
          if (jsonBody.priority) existingTask.priority = jsonBody.priority;
          if (jsonBody.deadline !== undefined) existingTask.deadline = jsonBody.deadline;

          if (
            (jsonBody.priority && jsonBody.priority !== prev.priority) ||
            (jsonBody.deadline !== undefined && jsonBody.deadline !== prev.deadline) ||
            (jsonBody.title && jsonBody.title !== prev.title)
          ) {
            this.logActivity(
              'TASK_EDITED',
              taskId,
              { priority: prev.priority, deadline: prev.deadline, title: prev.title },
              { priority: existingTask.priority, deadline: existingTask.deadline, title: existingTask.title }
            );
          }

          if (jsonBody.isArchived !== undefined && jsonBody.isArchived !== existingTask.isArchived) {
            existingTask.isArchived = jsonBody.isArchived;
            this.logActivity(
              jsonBody.isArchived ? 'TASK_ARCHIVED' : 'TASK_RESTORED',
              taskId,
              { isArchived: prev.isArchived },
              { isArchived: jsonBody.isArchived }
            );
          }

          existingTask.updatedAt = new Date().toISOString();

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, task: existingTask }));
          return;
        }

        // 8. Activities GET
        if (pathname === '/api/activities' && method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ activities: this.activities, total: this.activities.length }));
          return;
        }

        // 9. Workspace info
        if (pathname === '/api/workspace' && method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              workspace: DEFAULT_WORKSPACE,
              currentUser: { id: 'user-durgvijay-001', name: 'Durgvijay Chauhan', role: 'ADMIN' },
            })
          );
          return;
        }

        // 10. Default: Serve Complete Responsive Web UI Shell
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(this.renderAppHtml());
      });

      this.server.listen(this.port, () => {
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private renderAppHtml(): string {
    const tasksJson = JSON.stringify(Array.from(this.tasks.values()));
    const activitiesJson = JSON.stringify(this.activities);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>R.U.B.I. 2.0 - Voice Execution Assistant</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; min-height: 100%; font-family: system-ui, sans-serif; overflow-x: hidden; background: #0f172a; color: #f8fafc; }
    .container { max-width: 1280px; margin: 0 auto; padding: 1rem; }
    header { padding: 1rem 0; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center; }
    h1 { font-size: 1.5rem; font-weight: 700; color: #38bdf8; }
    .grid { display: grid; grid-template-columns: 1fr; gap: 1.5rem; margin-top: 1.5rem; }
    @media (min-width: 1024px) {
      .grid { grid-template-columns: 420px 1fr; }
    }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 0.75rem; padding: 1.25rem; }
    button { background: #2563eb; color: white; border: none; border-radius: 0.5rem; padding: 0.6rem 1rem; font-size: 0.9rem; font-weight: 600; cursor: pointer; min-height: 44px; min-width: 44px; display: inline-flex; align-items: center; justify-content: center; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    button.secondary { background: #475569; }
    button.danger { background: #dc2626; }
    button.success { background: #16a34a; }
    textarea, input, select { width: 100%; background: #0f172a; border: 1px solid #334155; border-radius: 0.5rem; padding: 0.6rem; color: #f8fafc; font-size: 0.9rem; min-height: 44px; }
    .badge { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 600; }
    .alert { padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 1rem; font-size: 0.875rem; }
    .alert-danger { background: #7f1d1d; color: #fecaca; border: 1px solid #b91c1c; }
    .alert-warning { background: #78350f; color: #fef3c7; border: 1px solid #d97706; }
    .alert-success { background: #064e3b; color: #a7f3d0; border: 1px solid #059669; }
    .task-item { background: #0f172a; border: 1px solid #334155; border-radius: 0.5rem; padding: 0.75rem; margin-bottom: 0.75rem; }
    .timeline-item { border-left: 2px solid #38bdf8; padding-left: 0.75rem; margin-bottom: 0.75rem; font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>R.U.B.I. 2.0</h1>
      <span class="badge" data-testid="processing-state-idle" data-state="idle">Ready</span>
    </header>

    <div class="grid">
      <!-- Voice & Transcription Console -->
      <section class="card" aria-label="Speech Console">
        <h2 style="font-size: 1.1rem; margin-bottom: 1rem;">Voice & Speech Console</h2>
        <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1rem;">
          <button id="record-btn" data-testid="record-toggle-btn" aria-label="Start recording">Record Voice</button>
          <button id="stop-btn" data-testid="stop-record-btn" aria-label="Stop recording" class="secondary" style="display: none;">Stop</button>
          <span id="timer" data-testid="record-timer" style="font-family: monospace; font-size: 1.1rem;">00:00</span>
        </div>
        <div data-testid="audio-waveform" style="height: 36px; background: #0f172a; border-radius: 0.375rem; margin-bottom: 1rem; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; color: #64748b;">
          Waveform Visualizer
        </div>

        <div style="margin-bottom: 1rem;">
          <label style="font-size: 0.8rem; display: block; margin-bottom: 0.4rem;">Or Upload Audio File (WAV/MP3/WebM):</label>
          <input type="file" id="file-input" data-testid="audio-file-input" accept="audio/*">
        </div>

        <div style="margin-top: 1rem;">
          <label style="font-size: 0.8rem; display: block; margin-bottom: 0.4rem;">Transcription Editor:</label>
          <textarea id="transcript-editor" data-testid="transcription-editor" rows="4" placeholder="Transcription will appear here..."></textarea>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
            <span id="word-count" data-testid="transcript-word-count" style="font-size: 0.8rem; color: #94a3b8;">0 words</span>
            <button id="extract-btn" data-testid="extract-actions-btn" class="success">Extract Actions</button>
          </div>
        </div>

        <!-- Spoken Confirmation Player -->
        <div id="tts-container" style="margin-top: 1rem; display: none;">
          <div class="alert alert-success" data-testid="spoken-confirmation-banner">
            <span id="tts-spoken-text" data-testid="tts-spoken-text"></span>
          </div>
          <audio id="audio-player" data-testid="tts-audio-player" controls style="width: 100%;"></audio>
        </div>
      </section>

      <!-- HITL Staging Review & Task Board -->
      <main>
        <!-- HITL Review Deck -->
        <section id="hitl-deck" class="card" data-testid="hitl-review-deck" style="display: none; margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2>Action Items Review (HITL)</h2>
            <div data-testid="tokens-telemetry-badge" class="badge" style="background: #334155;">
              590 tokens ($0.00009 USD)
            </div>
          </div>

          <div id="cycle-alert" class="alert alert-danger" data-testid="cycle-error-banner" style="display: none;">
            Circular dependency detected: Task Alpha cannot depend on Task Beta while Task Beta depends on Task Alpha.
          </div>

          <div id="ambig-alert" class="alert alert-warning" data-testid="ambiguity-warning" style="display: none;">
            Ambiguity detected: Assignee was not specified in conversation.
          </div>

          <div id="candidate-list"></div>

          <div style="display: flex; gap: 0.75rem; margin-top: 1rem;">
            <button id="batch-approve-btn" data-testid="batch-approve-btn" class="success" style="flex: 1;">Approve All Valid Tasks</button>
            <button id="discard-all-btn" data-testid="discard-all-btn" class="danger">Discard All</button>
          </div>
        </section>

        <!-- Task Board -->
        <section class="card" data-testid="task-board" style="margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2>Task Board</h2>
            <label style="font-size: 0.85rem; display: flex; align-items: center; gap: 0.4rem; cursor: pointer;">
              <input type="checkbox" id="show-archived" data-testid="filter-archived-checkbox" style="width: auto; min-height: auto;">
              Show Archived
            </label>
          </div>
          <div id="task-list"></div>
        </section>

        <!-- Immutable Activity Log -->
        <section class="card" data-testid="activity-timeline">
          <h2 style="margin-bottom: 1rem;">Immutable Activity History</h2>
          <div id="activity-list"></div>
        </section>
      </main>
    </div>
  </div>

  <script>
    const state = {
      recording: false,
      timerSeconds: 0,
      timerInterval: null,
      tasks: ${tasksJson},
      activities: ${activitiesJson},
      candidates: [],
    };

    const recordBtn = document.getElementById('record-btn');
    const stopBtn = document.getElementById('stop-btn');
    const timerEl = document.getElementById('timer');
    const fileInput = document.getElementById('file-input');
    const transcriptEditor = document.getElementById('transcript-editor');
    const wordCount = document.getElementById('word-count');
    const extractBtn = document.getElementById('extract-btn');
    const hitlDeck = document.getElementById('hitl-deck');
    const candidateList = document.getElementById('candidate-list');
    const batchApproveBtn = document.getElementById('batch-approve-btn');
    const taskList = document.getElementById('task-list');
    const activityList = document.getElementById('activity-list');
    const showArchived = document.getElementById('show-archived');
    const ttsContainer = document.getElementById('tts-container');
    const ttsSpokenText = document.getElementById('tts-spoken-text');
    const cycleAlert = document.getElementById('cycle-alert');
    const ambigAlert = document.getElementById('ambig-alert');

    function renderTasks() {
      taskList.innerHTML = '';
      const filterArchived = showArchived.checked;
      const visibleTasks = state.tasks.filter(t => filterArchived ? t.isArchived : !t.isArchived);

      visibleTasks.forEach(task => {
        const div = document.createElement('div');
        div.className = 'task-item';
        div.setAttribute('data-testid', 'task-card-' + task.id);
        div.setAttribute('data-status', task.status);

        let depHtml = '';
        if (task.dependencies && task.dependencies.length > 0) {
          depHtml = '<span class="badge" data-testid="dependency-tag" style="background: #991b1b; margin-right: 0.5rem;">BLOCKED BY: ' + task.dependencies.join(', ') + '</span>';
        }

        div.innerHTML =
          '<div style="display: flex; justify-content: space-between; align-items: start;">' +
            '<div>' +
              '<strong style="font-size: 1rem;">' + task.title + '</strong>' +
              '<div style="margin-top: 0.3rem;">' +
                depHtml +
                '<span class="badge" style="background: #2563eb; margin-right: 0.5rem;">' + task.status + '</span>' +
                '<span class="badge" style="background: #475569;">' + (task.assignee || 'Unassigned') + '</span>' +
              '</div>' +
            '</div>' +
            '<div style="display: flex; gap: 0.5rem;">' +
              '<select data-testid="task-status-select" style="width: auto;" onchange="updateTaskStatus(\\'' + task.id + '\\', this.value)">' +
                ['TO_DO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED'].map(s =>
                  '<option value="' + s + '" ' + (task.status === s ? 'selected' : '') + '>' + s + '</option>'
                ).join('') +
              '</select>' +
              '<button class="secondary" data-testid="archive-task-btn" onclick="toggleArchive(\\'' + task.id + '\\')">' +
                (task.isArchived ? 'Restore' : 'Archive') +
              '</button>' +
            '</div>' +
          '</div>';
        taskList.appendChild(div);
      });
    }

    function renderActivities() {
      activityList.innerHTML = '';
      state.activities.forEach(act => {
        const div = document.createElement('div');
        div.className = 'timeline-item';
        div.setAttribute('data-testid', 'activity-item');
        div.innerHTML =
          '<strong>' + act.eventType + '</strong> - ' + (act.taskId ? 'Task: ' + act.taskId : '') +
          '<div style="color: #64748b; font-size: 0.75rem;">' + act.createdAt + '</div>';
        activityList.appendChild(div);
      });
    }

    async function updateTaskStatus(taskId, newStatus) {
      const res = await fetch('/api/tasks/' + taskId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        const idx = state.tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) state.tasks[idx] = data.task;
        await refreshActivities();
        renderTasks();
      }
    }

    async function toggleArchive(taskId) {
      const task = state.tasks.find(t => t.id === taskId);
      if (!task) return;
      const res = await fetch('/api/tasks/' + taskId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: !task.isArchived }),
      });
      if (res.ok) {
        const data = await res.json();
        const idx = state.tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) state.tasks[idx] = data.task;
        await refreshActivities();
        renderTasks();
      }
    }

    async function refreshActivities() {
      const res = await fetch('/api/activities');
      if (res.ok) {
        const data = await res.json();
        state.activities = data.activities;
        renderActivities();
      }
    }

    showArchived.addEventListener('change', renderTasks);

    recordBtn.addEventListener('click', () => {
      state.recording = true;
      recordBtn.style.display = 'none';
      stopBtn.style.display = 'inline-flex';
      state.timerSeconds = 0;
      timerEl.innerText = '00:01';
      state.timerInterval = setInterval(() => {
        state.timerSeconds++;
        const m = String(Math.floor(state.timerSeconds / 60)).padStart(2, '0');
        const s = String(state.timerSeconds % 60).padStart(2, '0');
        timerEl.innerText = m + ':' + s;
      }, 1000);
    });

    stopBtn.addEventListener('click', async () => {
      state.recording = false;
      clearInterval(state.timerInterval);
      recordBtn.style.display = 'inline-flex';
      stopBtn.style.display = 'none';

      const res = await fetch('/api/speech/transcribe', { method: 'POST' });
      const data = await res.json();
      transcriptEditor.value = data.transcript || data.text || '';
      updateWordCount();
    });

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const res = await fetch('/api/speech/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'audio/wav' },
        body: file,
      });
      const data = await res.json();
      transcriptEditor.value = data.transcript || data.text || '';
      updateWordCount();
    });

    function updateWordCount() {
      const words = transcriptEditor.value.trim().split(/\\s+/).filter(Boolean);
      wordCount.innerText = words.length + ' words';
    }

    transcriptEditor.addEventListener('input', updateWordCount);

    extractBtn.addEventListener('click', async () => {
      const transcript = transcriptEditor.value;
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();

      if (data.bypassLLM) {
        if (data.intent === 'MARK_COMPLETED') {
          const tIdx = state.tasks.findIndex(t => t.id === data.affectedTaskId);
          if (tIdx !== -1) state.tasks[tIdx].status = 'COMPLETED';
          renderTasks();
          await refreshActivities();
        }
        return;
      }

      state.candidates = data.tasks || [];
      hitlDeck.style.display = 'block';

      if (data.hasCycle) {
        cycleAlert.style.display = 'block';
        batchApproveBtn.disabled = true;
      } else {
        cycleAlert.style.display = 'none';
        batchApproveBtn.disabled = false;
      }

      if (data.ambiguities && data.ambiguities.length > 0) {
        ambigAlert.style.display = 'block';
      } else {
        ambigAlert.style.display = 'none';
      }

      renderCandidates();
    });

    function renderCandidates() {
      candidateList.innerHTML = '';
      state.candidates.forEach((cand, idx) => {
        const card = document.createElement('div');
        card.className = 'task-item';
        card.setAttribute('data-testid', 'candidate-card-' + (cand.tempId || idx));
        card.innerHTML =
          '<div style="margin-bottom: 0.5rem;">' +
            '<input data-testid="card-title-input" name="title" value="' + cand.title + '">' +
          '</div>' +
          '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">' +
            '<input data-testid="card-assignee-input" name="assignee" placeholder="Assignee" value="' + (cand.owner || cand.assignee || '') + '">' +
            '<select data-testid="card-priority-select" name="priority">' +
              ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p =>
                '<option value="' + p + '" ' + (cand.priority === p ? 'selected' : '') + '>' + p + '</option>'
              ).join('') +
            '</select>' +
          '</div>' +
          '<div style="display: flex; gap: 0.5rem;">' +
            '<button class="success" data-testid="card-approve-btn" onclick="approveCandidate(' + idx + ')">Approve</button>' +
            '<button class="danger" data-testid="card-reject-btn" onclick="rejectCandidate(' + idx + ')">Reject</button>' +
          '</div>';
        candidateList.appendChild(card);
      });
    }

    async function approveCandidate(idx) {
      const cand = state.candidates[idx];
      const res = await fetch('/api/tasks/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: [cand] }),
      });
      if (res.ok) {
        const data = await res.json();
        data.tasks.forEach(t => state.tasks.push(t));
        state.candidates.splice(idx, 1);
        renderCandidates();
        renderTasks();
        await refreshActivities();
      }
    }

    function rejectCandidate(idx) {
      state.candidates.splice(idx, 1);
      renderCandidates();
    }

    batchApproveBtn.addEventListener('click', async () => {
      const res = await fetch('/api/tasks/approve-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: state.candidates }),
      });
      if (res.ok) {
        const data = await res.json();
        data.tasks.forEach(t => state.tasks.push(t));
        state.candidates = [];
        hitlDeck.style.display = 'none';
        renderTasks();
        await refreshActivities();
      }
    });

    // Initial render
    renderTasks();
    renderActivities();
  </script>
</body>
</html>`;
  }
}

// CLI runner if executed directly
if (process.argv[1]?.endsWith('mock-server.ts') || process.argv[1]?.endsWith('mock-server.js')) {
  const server = new StandaloneMockServer(parseInt(process.env.PORT || '5173', 10));
  server.start().then(() => {
    console.log(`[StandaloneMockServer] Running on http://127.0.0.1:${server.port}`);
  });
}
