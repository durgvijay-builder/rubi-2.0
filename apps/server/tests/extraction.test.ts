import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { prisma } from '../src/db.js';
import { DEFAULT_WORKSPACE_ID, DEMO_OWNER_ID } from '../prisma/seed.js';

describe('POST /api/extract & /api/ai/extract Integration Tests', () => {
  const TEST_TASK_SEED_ID = 'task-seed-3';

  beforeAll(async () => {
    // Ensure default workspace and owner user exist
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: { name: 'Gnani AI Showcase', slug: 'gnani-ai-showcase' },
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Gnani AI Showcase', slug: 'gnani-ai-showcase' },
    });

    await prisma.user.upsert({
      where: { id: DEMO_OWNER_ID },
      update: {},
      create: {
        id: DEMO_OWNER_ID,
        workspaceId: DEFAULT_WORKSPACE_ID,
        email: 'durgvijay@gnani.ai',
        name: 'Durgvijay Chauhan',
        role: 'OWNER',
      },
    });

    // Upsert task-seed-3 for deterministic intent completion tests
    await prisma.task.upsert({
      where: { id: TEST_TASK_SEED_ID },
      update: { status: 'TODO' },
      create: {
        id: TEST_TASK_SEED_ID,
        workspaceId: DEFAULT_WORKSPACE_ID,
        creatorId: DEMO_OWNER_ID,
        title: 'Complete architecture verification',
        description: 'Verification of architecture document',
        status: 'TODO',
        priority: 'HIGH',
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Workspace Authorization', () => {
    it('returns 401 when x-workspace-id header is missing', async () => {
      const res = await request(app)
        .post('/api/extract')
        .send({ transcript: 'Mark task #3 as completed.' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('WORKSPACE_HEADER_MISSING');
    });

    it('returns 403 when x-workspace-id does not exist', async () => {
      const res = await request(app)
        .post('/api/extract')
        .set('x-workspace-id', '00000000-0000-0000-0000-000000000000')
        .send({ transcript: 'Mark task #3 as completed.' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('WORKSPACE_UNAUTHORIZED');
    });
  });

  describe('Input Validation', () => {
    it('returns 400 Bad Request when transcript is missing', async () => {
      const res = await request(app)
        .post('/api/extract')
        .set('x-workspace-id', DEFAULT_WORKSPACE_ID)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Transcript is required');
    });

    it('returns 400 Bad Request when transcript is empty string', async () => {
      const res = await request(app)
        .post('/api/extract')
        .set('x-workspace-id', DEFAULT_WORKSPACE_ID)
        .send({ transcript: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Transcript is required');
    });
  });

  describe('Deterministic Intent Routing (Zero-Token Bypass)', () => {
    it('executes direct status completion command bypassing LLM (zero token cost)', async () => {
      const directCmd = 'Mark task #3 as completed.';
      const res = await request(app)
        .post('/api/extract')
        .set('x-workspace-id', DEFAULT_WORKSPACE_ID)
        .send({ transcript: directCmd });

      expect(res.status).toBe(200);
      expect(res.body.bypassLLM).toBe(true);
      expect(res.body.intent).toBe('MARK_COMPLETED');
      expect(res.body.tokensUsed.totalTokens).toBe(0);
      expect(res.body.tokensUsed.estimatedCostUsd).toBe(0);

      // Verify task was directly mutated in PostgreSQL
      const updatedTask = await prisma.task.findUnique({
        where: { id: TEST_TASK_SEED_ID },
      });
      expect(updatedTask?.status).toBe('COMPLETED');

      // Verify ActivityEvent was logged with bypassLLM flag
      const activity = await prisma.activityEvent.findFirst({
        where: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          taskId: TEST_TASK_SEED_ID,
          eventType: 'TASK_STATUS_CHANGED',
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(activity).toBeDefined();
      expect((activity?.metadata as any)?.bypassLLM).toBe(true);
    });

    it('deterministically handles backlog queries without calling LLM', async () => {
      const queryCmd = 'Show all pending tasks in the backlog.';
      const res = await request(app)
        .post('/api/extract')
        .set('x-workspace-id', DEFAULT_WORKSPACE_ID)
        .send({ transcript: queryCmd });

      expect(res.status).toBe(200);
      expect(res.body.bypassLLM).toBe(true);
      expect(res.body.intent).toBe('LIST_TASKS');
      expect(res.body.tokensUsed.totalTokens).toBe(0);
      expect(Array.isArray(res.body.tasks)).toBe(true);
    });

    it('works identically via /api/ai/extract alias route', async () => {
      const queryCmd = 'Pending tasks batao';
      const res = await request(app)
        .post('/api/ai/extract')
        .set('x-workspace-id', DEFAULT_WORKSPACE_ID)
        .send({ transcript: queryCmd });

      expect(res.status).toBe(200);
      expect(res.body.bypassLLM).toBe(true);
      expect(res.body.intent).toBe('LIST_TASKS');
      expect(res.body.tokensUsed.totalTokens).toBe(0);
    });
  });

  describe('Semantic Natural Language Extraction', () => {
    it('extracts candidate tasks from multi-task Hinglish sprint meeting', async () => {
      const transcript =
        'Kal subah 10 baje sprint planning meeting karni hai aur Durgvijay ko architecture document complete karna hai before Friday. Frontend dashboard integration blocked hai backend API se.';

      const res = await request(app)
        .post('/api/extract')
        .set('x-workspace-id', DEFAULT_WORKSPACE_ID)
        .send({ transcript });

      expect(res.status).toBe(200);
      expect(res.body.summary).toBeDefined();
      expect(res.body.tasks.length).toBe(3);
      expect(res.body.tasks[0].title).toMatch(/architecture document/i);
      expect(res.body.tasks[0].owner).toBe('Durgvijay');
      expect(res.body.tasks[2].dependencies).toContain('task-temp-1');
      expect(res.body.tokensUsed.totalTokens).toBeGreaterThan(0);
      expect(res.body.tokensUsed.estimatedCostUsd).toBeGreaterThan(0);
    });

    it('extracts ambiguous task with ambiguity warnings', async () => {
      const transcript = 'Fix this critical production bug as soon as possible before the release.';

      const res = await request(app)
        .post('/api/extract')
        .set('x-workspace-id', DEFAULT_WORKSPACE_ID)
        .send({ transcript });

      expect(res.status).toBe(200);
      expect(res.body.tasks.length).toBe(1);
      expect(res.body.tasks[0].owner).toBeNull();
      expect(res.body.tasks[0].ambiguities.length).toBeGreaterThan(0);
      expect(res.body.ambiguities.length).toBeGreaterThan(0);
    });
  });
});
