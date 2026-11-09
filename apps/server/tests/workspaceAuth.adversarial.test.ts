import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import { app } from '../src/index.js';
import { prisma } from '../src/db.js';
import { DEFAULT_WORKSPACE_ID } from '../prisma/seed.js';
import { workspaceAuth } from '../src/middleware/workspaceAuth.js';

const TENANT_B_WORKSPACE_ID = '22222222-2222-2222-2222-222222222222';

describe('Adversarial Workspace Authorization Middleware Test Suite', () => {
  beforeAll(async () => {
    // Ensure primary showcase workspace exists
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: { name: 'Gnani AI Showcase', slug: 'gnani-ai-showcase' },
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Gnani AI Showcase', slug: 'gnani-ai-showcase' },
    });

    // Create a second isolated workspace for multi-tenant isolation testing
    await prisma.workspace.upsert({
      where: { id: TENANT_B_WORKSPACE_ID },
      update: { name: 'Tenant B Isolated Workspace', slug: 'tenant-b-isolated' },
      create: { id: TENANT_B_WORKSPACE_ID, name: 'Tenant B Isolated Workspace', slug: 'tenant-b-isolated' },
    });
  });

  afterAll(async () => {
    // Clean up Tenant B workspace and disconnect
    await prisma.workspace.deleteMany({
      where: { id: TENANT_B_WORKSPACE_ID },
    });
    await prisma.$disconnect();
  });

  // ── 1. Missing Header Vectors (Must Return 401 Unauthorized) ────────────────
  describe('Missing / Empty x-workspace-id Header (401 Unauthorized)', () => {
    it('rejects request with missing x-workspace-id header with 401', async () => {
      const res = await request(app).get('/api/workspace');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Missing x-workspace-id header');
      expect(res.body.code).toBe('WORKSPACE_HEADER_MISSING');
    });

    it('rejects request with empty string x-workspace-id header ("") with 401', async () => {
      const res = await request(app)
        .get('/api/workspace')
        .set('x-workspace-id', '');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Missing x-workspace-id header');
      expect(res.body.code).toBe('WORKSPACE_HEADER_MISSING');
    });

    it('rejects request with whitespace-only x-workspace-id header ("   ") with 401', async () => {
      const res = await request(app)
        .get('/api/workspace')
        .set('x-workspace-id', '   ');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Missing x-workspace-id header');
      expect(res.body.code).toBe('WORKSPACE_HEADER_MISSING');
    });
  });

  // ── 2. Malformed / Non-Existent ID Vectors (Must Return 403 / 404 Forbidden) ─
  describe('Malformed / Non-Existent Workspace IDs (403 Forbidden)', () => {
    it('rejects non-existent valid UUID format (00000000-0000-0000-0000-000000000000) with 403', async () => {
      const res = await request(app)
        .get('/api/workspace')
        .set('x-workspace-id', '00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
      expect(res.body.code).toBe('WORKSPACE_UNAUTHORIZED');
    });

    it('rejects arbitrary malformed non-UUID alphanumeric identifier with 403', async () => {
      const res = await request(app)
        .get('/api/workspace')
        .set('x-workspace-id', 'malformed_workspace_id_xyz_123');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
      expect(res.body.code).toBe('WORKSPACE_UNAUTHORIZED');
    });

    it('rejects SQL injection attempt in header without leaking database internals', async () => {
      const injectionPayload = "'; SELECT * FROM workspaces WHERE ''='";
      const res = await request(app)
        .get('/api/workspace')
        .set('x-workspace-id', injectionPayload);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
      expect(res.body.code).toBe('WORKSPACE_UNAUTHORIZED');
    });

    it('rejects SQL boolean injection ("1\' OR \'1\'=\'1") with 403', async () => {
      const res = await request(app)
        .get('/api/workspace')
        .set('x-workspace-id', "1' OR '1'='1");
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
      expect(res.body.code).toBe('WORKSPACE_UNAUTHORIZED');
    });

    it('rejects XSS script payload in header with 403', async () => {
      const res = await request(app)
        .get('/api/workspace')
        .set('x-workspace-id', "<script>alert('pwned')</script>");
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
      expect(res.body.code).toBe('WORKSPACE_UNAUTHORIZED');
    });

    it('rejects directory traversal payload in header with 403', async () => {
      const res = await request(app)
        .get('/api/workspace')
        .set('x-workspace-id', '../../../../etc/passwd');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
      expect(res.body.code).toBe('WORKSPACE_UNAUTHORIZED');
    });

    it('rejects massive buffer/DoS string (10,000 characters) safely with 403', async () => {
      const largePayload = 'A'.repeat(10000);
      const res = await request(app)
        .get('/api/workspace')
        .set('x-workspace-id', largePayload);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
      expect(res.body.code).toBe('WORKSPACE_UNAUTHORIZED');
    });
  });

  // ── 3. Valid Workspace Access & Multi-Tenant Isolation (200 OK) ────────────
  describe('Valid Workspace Access & Multi-Tenant Scoping (200 OK)', () => {
    it('authenticates valid showcase workspace ID and returns 200 with workspace data', async () => {
      const res = await request(app)
        .get('/api/workspace')
        .set('x-workspace-id', DEFAULT_WORKSPACE_ID);
      expect(res.status).toBe(200);
      expect(res.body.workspace).toBeDefined();
      expect(res.body.workspace.id).toBe(DEFAULT_WORKSPACE_ID);
      expect(res.body.workspace.name).toBe('Gnani AI Showcase');
      expect(res.body.workspace.slug).toBe('gnani-ai-showcase');
    });

    it('authenticates valid workspace ID even with untrimmed leading/trailing whitespace', async () => {
      const res = await request(app)
        .get('/api/workspace')
        .set('x-workspace-id', `   ${DEFAULT_WORKSPACE_ID}   `);
      expect(res.status).toBe(200);
      expect(res.body.workspace).toBeDefined();
      expect(res.body.workspace.id).toBe(DEFAULT_WORKSPACE_ID);
    });

    it('enforces multi-tenant isolation: Tenant B request resolves Tenant B workspace, not Tenant A', async () => {
      const resB = await request(app)
        .get('/api/workspace')
        .set('x-workspace-id', TENANT_B_WORKSPACE_ID);
      expect(resB.status).toBe(200);
      expect(resB.body.workspace.id).toBe(TENANT_B_WORKSPACE_ID);
      expect(resB.body.workspace.name).toBe('Tenant B Isolated Workspace');

      // Tenant A request resolves Tenant A
      const resA = await request(app)
        .get('/api/workspace')
        .set('x-workspace-id', DEFAULT_WORKSPACE_ID);
      expect(resA.status).toBe(200);
      expect(resA.body.workspace.id).toBe(DEFAULT_WORKSPACE_ID);
      expect(resA.body.workspace.name).toBe('Gnani AI Showcase');
    });
  });

  // ── 4. Unit-level Middleware Failure Propagation ───────────────────────────
  describe('Middleware Unit Execution & Error Propagation', () => {
    it('forwards database unexpected exceptions to next(error)', async () => {
      const mockReq = {
        headers: { 'x-workspace-id': 'mock-id' },
      } as unknown as Request;

      let statusCode = 0;
      let jsonPayload: unknown = null;
      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (payload: unknown) => { jsonPayload = payload; },
          };
        },
      } as unknown as Response;

      // Mock prisma.workspace.findUnique to simulate database disconnection/error
      const originalFindUnique = prisma.workspace.findUnique;
      const testError = new Error('Database connection failed');
      (prisma.workspace as unknown as { findUnique: unknown }).findUnique = async () => {
        throw testError;
      };

      let passedError: unknown = null;
      const mockNext: NextFunction = (err?: unknown) => {
        passedError = err;
      };

      try {
        await workspaceAuth(mockReq, mockRes, mockNext);
        expect(passedError).toBe(testError);
      } finally {
        // Restore prisma.workspace.findUnique
        (prisma.workspace as unknown as { findUnique: unknown }).findUnique = originalFindUnique;
      }
    });
  });

  // ── 5. Adversarial Remediations: Dependency Validation & Enum Guards ───────
  describe('Milestone 5 Remediation Verifications (Dependency Validation & Enum Guards)', () => {
    it('TC-REM-01: Rejects unknown external prerequisite dependency IDs with HTTP 422', async () => {
      const nonExistentPrereqId = 'non-existent-task-uuid-8888';
      const payload = {
        tasks: [
          {
            tempId: 'temp-rem-1',
            title: 'Task with non-existent dependency',
            dependencies: [nonExistentPrereqId],
          },
        ],
      };

      const res = await request(app)
        .post('/api/tasks/approve-all')
        .set('x-workspace-id', DEFAULT_WORKSPACE_ID)
        .send(payload);

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Unprocessable Entity');
      expect(res.body.message).toBe(
        `Referenced prerequisite task "${nonExistentPrereqId}" does not exist in workspace.`
      );
    });

    it('TC-REM-02: Rejects cross-workspace prerequisite task ID with HTTP 422', async () => {
      // Create a task in Tenant B workspace
      const tenantBTask = await prisma.task.create({
        data: {
          workspaceId: TENANT_B_WORKSPACE_ID,
          title: 'Tenant B Isolated Task',
          status: 'TODO',
          priority: 'MEDIUM',
        },
      });

      // Attempt to reference Tenant B's task from Tenant A (DEFAULT_WORKSPACE_ID)
      const payload = {
        tasks: [
          {
            tempId: 'temp-rem-cross',
            title: 'Tenant A task attempting to depend on Tenant B',
            dependencies: [tenantBTask.id],
          },
        ],
      };

      const res = await request(app)
        .post('/api/tasks/approve-all')
        .set('x-workspace-id', DEFAULT_WORKSPACE_ID)
        .send(payload);

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Unprocessable Entity');
      expect(res.body.message).toBe(
        `Referenced prerequisite task "${tenantBTask.id}" does not exist in workspace.`
      );

      // Clean up tenant B task
      await prisma.task.delete({ where: { id: tenantBTask.id } });
    });

    it('TC-REM-03: Rejects invalid status string in PATCH /api/tasks/:id with HTTP 400', async () => {
      // First create a valid task in showcase workspace
      const createRes = await request(app)
        .post('/api/tasks')
        .set('x-workspace-id', DEFAULT_WORKSPACE_ID)
        .send({ title: 'Task For Invalid Enum Test' });
      expect(createRes.status).toBe(201);
      const taskId = createRes.body.task.id;

      // Send invalid status
      const patchRes = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('x-workspace-id', DEFAULT_WORKSPACE_ID)
        .send({ status: 'INVALID_STATUS_STRING' });

      expect(patchRes.status).toBe(400);
      expect(patchRes.body.error).toBe('Bad Request');
      expect(patchRes.body.message).toBe('Invalid status or priority value');
    });

    it('TC-REM-04: Rejects invalid priority string in PATCH /api/tasks/:id with HTTP 400', async () => {
      const createRes = await request(app)
        .post('/api/tasks')
        .set('x-workspace-id', DEFAULT_WORKSPACE_ID)
        .send({ title: 'Task For Invalid Priority Test' });
      expect(createRes.status).toBe(201);
      const taskId = createRes.body.task.id;

      const patchRes = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('x-workspace-id', DEFAULT_WORKSPACE_ID)
        .send({ priority: 'SUPER_CRITICAL_NON_EXISTENT' });

      expect(patchRes.status).toBe(400);
      expect(patchRes.body.error).toBe('Bad Request');
      expect(patchRes.body.message).toBe('Invalid status or priority value');
    });

    it('TC-REM-05: Accepts all canonical allowed statuses in PATCH /api/tasks/:id', async () => {
      const createRes = await request(app)
        .post('/api/tasks')
        .set('x-workspace-id', DEFAULT_WORKSPACE_ID)
        .send({ title: 'Task For Valid Status Transitions' });
      expect(createRes.status).toBe(201);
      const taskId = createRes.body.task.id;

      const validStatuses = [
        'PENDING_APPROVAL',
        'TODO',
        'TO_DO',
        'IN_PROGRESS',
        'BLOCKED',
        'COMPLETED',
        'CANCELLED',
        'ARCHIVED',
      ];

      for (const validStatus of validStatuses) {
        const patchRes = await request(app)
          .patch(`/api/tasks/${taskId}`)
          .set('x-workspace-id', DEFAULT_WORKSPACE_ID)
          .send({ status: validStatus });

        expect(patchRes.status).toBe(200);
        expect(patchRes.body.success).toBe(true);
      }
    });

    it('TC-REM-06: Accepts all canonical allowed priorities in PATCH /api/tasks/:id', async () => {
      const createRes = await request(app)
        .post('/api/tasks')
        .set('x-workspace-id', DEFAULT_WORKSPACE_ID)
        .send({ title: 'Task For Valid Priority Transitions' });
      expect(createRes.status).toBe(201);
      const taskId = createRes.body.task.id;

      const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

      for (const validPriority of validPriorities) {
        const patchRes = await request(app)
          .patch(`/api/tasks/${taskId}`)
          .set('x-workspace-id', DEFAULT_WORKSPACE_ID)
          .send({ priority: validPriority });

        expect(patchRes.status).toBe(200);
        expect(patchRes.body.success).toBe(true);
        expect(patchRes.body.task.priority).toBe(validPriority);
      }
    });
  });
});
