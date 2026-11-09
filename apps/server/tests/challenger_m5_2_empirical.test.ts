import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { prisma } from '../src/db.js';
import { PRIMARY_WORKSPACE_ID } from '../prisma/seed.js';

const TENANT_A_WORKSPACE_ID = PRIMARY_WORKSPACE_ID; // workspace-rubi-primary-001
const TENANT_B_WORKSPACE_ID = '99999999-9999-9999-9999-999999999999';

describe('CHALLENGER 2 EMPIRICAL AUDIT: Milestone 5 Backend Task & Activity Services', () => {
  beforeAll(async () => {
    // Ensure Tenant A and Tenant B workspaces exist in PostgreSQL
    await prisma.workspace.upsert({
      where: { id: TENANT_A_WORKSPACE_ID },
      update: { name: 'Tenant A Primary Workspace', slug: 'tenant-a-primary' },
      create: { id: TENANT_A_WORKSPACE_ID, name: 'Tenant A Primary Workspace', slug: 'tenant-a-primary' },
    });

    await prisma.workspace.upsert({
      where: { id: TENANT_B_WORKSPACE_ID },
      update: { name: 'Challenger M5-2 Isolated Workspace', slug: 'challenger-m5-2-isolated' },
      create: { id: TENANT_B_WORKSPACE_ID, name: 'Challenger M5-2 Isolated Workspace', slug: 'challenger-m5-2-isolated' },
    });
  });

  afterAll(async () => {
    // Clean up test tasks created during this run
    await prisma.taskDependency.deleteMany({
      where: {
        task: {
          title: { contains: '[CHALLENGER-M5-2]' },
        },
      },
    });
    await prisma.activityEvent.deleteMany({
      where: {
        description: { contains: '[CHALLENGER-M5-2]' },
      },
    });
    await prisma.task.deleteMany({
      where: {
        title: { contains: '[CHALLENGER-M5-2]' },
      },
    });

    // Clean up Tenant B workspace
    await prisma.workspace.deleteMany({
      where: { id: TENANT_B_WORKSPACE_ID },
    });

    await prisma.$disconnect();
  });

  // ===========================================================================
  // SCOPE 1: COMMIT-STAGE DAG CYCLE PREVENTION (TC-BOUND-04 & ADVANCED TOPOLOGIES)
  // ===========================================================================
  describe('Scope 1: Commit-Stage DAG Cycle Prevention (TC-BOUND-04)', () => {
    it('1.1: Direct 2-node cycle (A <-> B) submitted to POST /api/tasks/approve-all returns HTTP 422 and 0 tasks persisted', async () => {
      const circularBatch = {
        tasks: [
          {
            tempId: 'cycle-node-a',
            title: '[CHALLENGER-M5-2] Circular Task Alpha',
            priority: 'HIGH',
            dependencies: ['cycle-node-b'],
          },
          {
            tempId: 'cycle-node-b',
            title: '[CHALLENGER-M5-2] Circular Task Beta',
            priority: 'HIGH',
            dependencies: ['cycle-node-a'],
          },
        ],
      };

      const res = await request(app)
        .post('/api/tasks/approve-all')
        .set('x-workspace-id', TENANT_A_WORKSPACE_ID)
        .send(circularBatch);

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Unprocessable Entity');
      expect(res.body.message).toContain('circular dependency unresolved');

      // Database assertion: zero tasks persisted
      const persisted = await prisma.task.findMany({
        where: {
          title: { in: ['[CHALLENGER-M5-2] Circular Task Alpha', '[CHALLENGER-M5-2] Circular Task Beta'] },
        },
      });
      expect(persisted).toHaveLength(0);
    });

    it('1.2: 3-node cycle (A -> B -> C -> A) submitted to POST /api/tasks/approve returns HTTP 422 with zero persistence', async () => {
      const triangleBatch = {
        tasks: [
          {
            tempId: 'tri-a',
            title: '[CHALLENGER-M5-2] Triangle A',
            dependencies: ['tri-c'],
          },
          {
            tempId: 'tri-b',
            title: '[CHALLENGER-M5-2] Triangle B',
            dependencies: ['tri-a'],
          },
          {
            tempId: 'tri-c',
            title: '[CHALLENGER-M5-2] Triangle C',
            dependencies: ['tri-b'],
          },
        ],
      };

      const res = await request(app)
        .post('/api/tasks/approve')
        .set('x-workspace-id', TENANT_A_WORKSPACE_ID)
        .send(triangleBatch);

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Unprocessable Entity');

      // Verify no tasks persisted
      const persisted = await prisma.task.findMany({
        where: {
          title: { in: ['[CHALLENGER-M5-2] Triangle A', '[CHALLENGER-M5-2] Triangle B', '[CHALLENGER-M5-2] Triangle C'] },
        },
      });
      expect(persisted).toHaveLength(0);
    });

    it('1.3: Self-referencing task (A -> A) submitted to POST /api/tasks/approve-all returns HTTP 422', async () => {
      const selfBatch = {
        tasks: [
          {
            tempId: 'self-node',
            title: '[CHALLENGER-M5-2] Self Cyclic Task',
            dependencies: ['self-node'],
          },
        ],
      };

      const res = await request(app)
        .post('/api/tasks/approve-all')
        .set('x-workspace-id', TENANT_A_WORKSPACE_ID)
        .send(selfBatch);

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Unprocessable Entity');
    });

    it('1.4: Batch with mixed valid and circular tasks rolls back atomically (0 tasks persisted)', async () => {
      const mixedBatch = {
        tasks: [
          {
            tempId: 'valid-independent-1',
            title: '[CHALLENGER-M5-2] Innocent Valid Task 1',
            dependencies: [],
          },
          {
            tempId: 'valid-independent-2',
            title: '[CHALLENGER-M5-2] Innocent Valid Task 2',
            dependencies: [],
          },
          {
            tempId: 'poison-cycle-x',
            title: '[CHALLENGER-M5-2] Poison Cycle X',
            dependencies: ['poison-cycle-y'],
          },
          {
            tempId: 'poison-cycle-y',
            title: '[CHALLENGER-M5-2] Poison Cycle Y',
            dependencies: ['poison-cycle-x'],
          },
        ],
      };

      const res = await request(app)
        .post('/api/tasks/approve-all')
        .set('x-workspace-id', TENANT_A_WORKSPACE_ID)
        .send(mixedBatch);

      expect(res.status).toBe(422);

      // Verify transaction atomicity: even innocent tasks were not committed
      const innocentFound = await prisma.task.findMany({
        where: {
          title: { in: ['[CHALLENGER-M5-2] Innocent Valid Task 1', '[CHALLENGER-M5-2] Innocent Valid Task 2'] },
        },
      });
      expect(innocentFound).toHaveLength(0);
    });

    it('1.5: Batch with cycleError: true flag is rejected immediately with HTTP 422', async () => {
      const flaggedBatch = {
        tasks: [
          {
            tempId: 'flagged-task',
            title: '[CHALLENGER-M5-2] Flagged Cycle Error Task',
            cycleError: true,
            dependencies: [],
          },
        ],
      };

      const res = await request(app)
        .post('/api/tasks/approve-all')
        .set('x-workspace-id', TENANT_A_WORKSPACE_ID)
        .send(flaggedBatch);

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Unprocessable Entity');
      expect(res.body.message).toContain('circular dependency unresolved');
    });
  });

  // ===========================================================================
  // SCOPE 2: AUTOMATED UNBLOCKING CASCADE & IMMUTABLE ACTIVITY LOGGING
  // ===========================================================================
  describe('Scope 2: Automated Unblocking Cascade & Activity Logging', () => {
    it('2.1: Completing a blocking task unblocks dependent from BLOCKED to TO_DO and logs TASK_STATUS_CHANGED with newState.status: TO_DO', async () => {
      // 1. Commit 2-node dependency chain: Prerequisite -> Dependent
      const createRes = await request(app)
        .post('/api/tasks/approve-all')
        .set('x-workspace-id', TENANT_A_WORKSPACE_ID)
        .send({
          tasks: [
            {
              tempId: 'unblock-prereq-1',
              title: '[CHALLENGER-M5-2] Prerequisite Service Task',
              owner: 'Prereq Engineer',
              priority: 'HIGH',
              dependencies: [],
            },
            {
              tempId: 'unblock-dep-1',
              title: '[CHALLENGER-M5-2] Dependent Consumer Task',
              owner: 'Consumer Engineer',
              priority: 'HIGH',
              dependencies: ['unblock-prereq-1'],
            },
          ],
        });

      expect(createRes.status).toBe(201);
      const prereq = createRes.body.tasks.find((t: any) => t.title.includes('Prerequisite Service Task'));
      const dependent = createRes.body.tasks.find((t: any) => t.title.includes('Dependent Consumer Task'));

      expect(prereq).toBeDefined();
      expect(dependent).toBeDefined();
      expect(prereq.status).toBe('TO_DO');
      expect(dependent.status).toBe('BLOCKED');
      expect(dependent.dependencies).toContain(prereq.id);

      // 2. Mark Prerequisite as COMPLETED via PATCH /api/tasks/:id
      const patchRes = await request(app)
        .patch(`/api/tasks/${prereq.id}`)
        .set('x-workspace-id', TENANT_A_WORKSPACE_ID)
        .send({ status: 'COMPLETED' });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.task.status).toBe('COMPLETED');

      // 3. Verify dependent task has transitioned from BLOCKED to TO_DO
      const depRes = await request(app)
        .get(`/api/tasks`)
        .set('x-workspace-id', TENANT_A_WORKSPACE_ID);

      const refreshedDep = depRes.body.tasks.find((t: any) => t.id === dependent.id);
      expect(refreshedDep).toBeDefined();
      expect(refreshedDep.status).toBe('TO_DO');

      // 4. Verify Activity Event log for dependent task
      const actRes = await request(app)
        .get(`/api/activities?taskId=${dependent.id}`)
        .set('x-workspace-id', TENANT_A_WORKSPACE_ID);

      expect(actRes.status).toBe(200);
      const activities = actRes.body.activities;
      expect(activities.length).toBeGreaterThanOrEqual(1);

      const unblockEvent = activities.find(
        (a: any) =>
          a.eventType === 'TASK_STATUS_CHANGED' &&
          (a.newState?.status === 'TO_DO' || a.metadata?.newState?.status === 'TO_DO')
      );

      expect(unblockEvent).toBeDefined();
      expect(unblockEvent.description).toContain('unblocked');
      expect(unblockEvent.metadata.previousState.status).toBe('BLOCKED');
      expect(unblockEvent.metadata.newState.status).toBe('TO_DO');
    });

    it('2.2: Multi-prerequisite cascade: dependent stays BLOCKED until ALL prerequisites complete', async () => {
      // Create P1, P2, and Child blocked by [P1, P2]
      const batchRes = await request(app)
        .post('/api/tasks/approve-all')
        .set('x-workspace-id', TENANT_A_WORKSPACE_ID)
        .send({
          tasks: [
            { tempId: 'p1', title: '[CHALLENGER-M5-2] Dual Prereq Part 1', dependencies: [] },
            { tempId: 'p2', title: '[CHALLENGER-M5-2] Dual Prereq Part 2', dependencies: [] },
            { tempId: 'child', title: '[CHALLENGER-M5-2] Dual Prereq Child', dependencies: ['p1', 'p2'] },
          ],
        });

      expect(batchRes.status).toBe(201);
      const p1 = batchRes.body.tasks.find((t: any) => t.title.includes('Dual Prereq Part 1'));
      const p2 = batchRes.body.tasks.find((t: any) => t.title.includes('Dual Prereq Part 2'));
      const child = batchRes.body.tasks.find((t: any) => t.title.includes('Dual Prereq Child'));

      expect(child.status).toBe('BLOCKED');

      // Complete P1 only
      await request(app)
        .patch(`/api/tasks/${p1.id}`)
        .set('x-workspace-id', TENANT_A_WORKSPACE_ID)
        .send({ status: 'COMPLETED' });

      // Verify Child is STILL BLOCKED because P2 is not completed
      const check1 = await request(app).get('/api/tasks').set('x-workspace-id', TENANT_A_WORKSPACE_ID);
      const childStillBlocked = check1.body.tasks.find((t: any) => t.id === child.id);
      expect(childStillBlocked.status).toBe('BLOCKED');

      // Complete P2
      await request(app)
        .patch(`/api/tasks/${p2.id}`)
        .set('x-workspace-id', TENANT_A_WORKSPACE_ID)
        .send({ status: 'COMPLETED' });

      // Verify Child is NOW TO_DO
      const check2 = await request(app).get('/api/tasks').set('x-workspace-id', TENANT_A_WORKSPACE_ID);
      const childUnblocked = check2.body.tasks.find((t: any) => t.id === child.id);
      expect(childUnblocked.status).toBe('TO_DO');
    });

    it('2.3: Sequential 3-tier cascade (T1 -> T2 -> T3): completing T1 unblocks T2, but T3 remains BLOCKED until T2 completes', async () => {
      const batchRes = await request(app)
        .post('/api/tasks/approve-all')
        .set('x-workspace-id', TENANT_A_WORKSPACE_ID)
        .send({
          tasks: [
            { tempId: 'tier1', title: '[CHALLENGER-M5-2] Tier 1 Base', dependencies: [] },
            { tempId: 'tier2', title: '[CHALLENGER-M5-2] Tier 2 Middle', dependencies: ['tier1'] },
            { tempId: 'tier3', title: '[CHALLENGER-M5-2] Tier 3 Top', dependencies: ['tier2'] },
          ],
        });

      expect(batchRes.status).toBe(201);
      const t1 = batchRes.body.tasks.find((t: any) => t.title.includes('Tier 1 Base'));
      const t2 = batchRes.body.tasks.find((t: any) => t.title.includes('Tier 2 Middle'));
      const t3 = batchRes.body.tasks.find((t: any) => t.title.includes('Tier 3 Top'));

      expect(t1.status).toBe('TO_DO');
      expect(t2.status).toBe('BLOCKED');
      expect(t3.status).toBe('BLOCKED');

      // Complete T1
      await request(app).patch(`/api/tasks/${t1.id}`).set('x-workspace-id', TENANT_A_WORKSPACE_ID).send({ status: 'COMPLETED' });

      const midCheck = await request(app).get('/api/tasks').set('x-workspace-id', TENANT_A_WORKSPACE_ID);
      const t2AfterT1 = midCheck.body.tasks.find((t: any) => t.id === t2.id);
      const t3AfterT1 = midCheck.body.tasks.find((t: any) => t.id === t3.id);

      expect(t2AfterT1.status).toBe('TO_DO');
      expect(t3AfterT1.status).toBe('BLOCKED'); // Still blocked by T2

      // Complete T2
      await request(app).patch(`/api/tasks/${t2.id}`).set('x-workspace-id', TENANT_A_WORKSPACE_ID).send({ status: 'COMPLETED' });

      const finalCheck = await request(app).get('/api/tasks').set('x-workspace-id', TENANT_A_WORKSPACE_ID);
      const t3AfterT2 = finalCheck.body.tasks.find((t: any) => t.id === t3.id);

      expect(t3AfterT2.status).toBe('TO_DO'); // Now unblocked
    });
  });

  // ===========================================================================
  // SCOPE 3: MULTI-TENANT WORKSPACE ISOLATION & AUTHORIZATION
  // ===========================================================================
  describe('Scope 3: Multi-Tenant Workspace Isolation', () => {
    it('3.1: Request without x-workspace-id header returns HTTP 401 Unauthorized', async () => {
      const res = await request(app).get('/api/tasks');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Missing x-workspace-id header');
      expect(res.body.code).toBe('WORKSPACE_HEADER_MISSING');
    });

    it('3.2: Request with empty string or whitespace-only x-workspace-id returns HTTP 401 Unauthorized', async () => {
      const resEmpty = await request(app).get('/api/tasks').set('x-workspace-id', '');
      expect(resEmpty.status).toBe(401);
      expect(resEmpty.body.code).toBe('WORKSPACE_HEADER_MISSING');

      const resSpace = await request(app).get('/api/tasks').set('x-workspace-id', '    ');
      expect(resSpace.status).toBe(401);
      expect(resSpace.body.code).toBe('WORKSPACE_HEADER_MISSING');
    });

    it('3.3: Request with cross-workspace ID (workspace-rubi-foreign-999) returns HTTP 403 Forbidden with { error: "Forbidden" }', async () => {
      const res = await request(app)
        .get('/api/tasks')
        .set('x-workspace-id', 'workspace-rubi-foreign-999');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
      expect(res.body.message).toContain('Unauthorized workspace access: cross-workspace query rejected');
    });

    it('3.4: Request with generic non-existent workspace ID returns HTTP 403', async () => {
      const res = await request(app)
        .get('/api/tasks')
        .set('x-workspace-id', 'non-existent-workspace-random-987');

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('WORKSPACE_UNAUTHORIZED');
      expect(res.body.message).toContain('Unauthorized workspace access: cross-workspace query rejected');
    });

    it('3.5: Multi-tenant database boundary isolation: Tenant B cannot query or mutate Tenant A tasks', async () => {
      // 1. Create a task in Tenant A
      const createRes = await request(app)
        .post('/api/tasks')
        .set('x-workspace-id', TENANT_A_WORKSPACE_ID)
        .send({ title: '[CHALLENGER-M5-2] Tenant A Confidential Task' });

      expect(createRes.status).toBe(201);
      const tenantATaskId = createRes.body.task.id;

      // 2. Query tasks under Tenant B context
      const listTenantB = await request(app)
        .get('/api/tasks')
        .set('x-workspace-id', TENANT_B_WORKSPACE_ID);

      expect(listTenantB.status).toBe(200);
      const leakedTask = listTenantB.body.tasks.find((t: any) => t.id === tenantATaskId);
      expect(leakedTask).toBeUndefined(); // Zero leakage

      // 3. Attempt to query dependencies of Tenant A task using Tenant B header
      const depRes = await request(app)
        .get(`/api/tasks/${tenantATaskId}/dependencies`)
        .set('x-workspace-id', TENANT_B_WORKSPACE_ID);

      expect(depRes.status).toBe(404);
      expect(depRes.body.error).toBe('Not Found');

      // 4. Attempt to update Tenant A task using Tenant B header
      const updateRes = await request(app)
        .patch(`/api/tasks/${tenantATaskId}`)
        .set('x-workspace-id', TENANT_B_WORKSPACE_ID)
        .send({ title: 'Hacked by Tenant B' });

      expect(updateRes.status).toBe(404);
      expect(updateRes.body.error).toBe('Not Found');

      // 5. Attempt to archive Tenant A task using Tenant B header
      const archiveRes = await request(app)
        .post(`/api/tasks/${tenantATaskId}/archive`)
        .set('x-workspace-id', TENANT_B_WORKSPACE_ID);

      expect(archiveRes.status).toBe(404);
      expect(archiveRes.body.error).toBe('Not Found');

      // 6. Verify Tenant A task remains pristine and unaffected in Tenant A
      const verifyRes = await request(app)
        .get('/api/tasks')
        .set('x-workspace-id', TENANT_A_WORKSPACE_ID);

      const intactTask = verifyRes.body.tasks.find((t: any) => t.id === tenantATaskId);
      expect(intactTask).toBeDefined();
      expect(intactTask.title).toBe('[CHALLENGER-M5-2] Tenant A Confidential Task');
      expect(intactTask.isArchived).toBe(false);
    });
  });

  // ===========================================================================
  // SCOPE 4: SOFT ARCHIVAL & TASK_ARCHIVED AUDIT TRAIL
  // ===========================================================================
  describe('Scope 4: Soft Archival & TASK_ARCHIVED Audit Logging', () => {
    it('4.1: POST /api/tasks/:id/archive updates status to ARCHIVED, sets isArchived: true, and logs TASK_ARCHIVED', async () => {
      // 1. Create active task
      const createRes = await request(app)
        .post('/api/tasks')
        .set('x-workspace-id', TENANT_A_WORKSPACE_ID)
        .send({
          title: '[CHALLENGER-M5-2] Task to be Archived',
          priority: 'MEDIUM',
        });

      expect(createRes.status).toBe(201);
      const taskId = createRes.body.task.id;
      expect(createRes.body.task.status).toBe('TO_DO');
      expect(createRes.body.task.isArchived).toBe(false);

      // 2. Call POST /api/tasks/:id/archive
      const archiveRes = await request(app)
        .post(`/api/tasks/${taskId}/archive`)
        .set('x-workspace-id', TENANT_A_WORKSPACE_ID);

      expect(archiveRes.status).toBe(200);
      expect(archiveRes.body.success).toBe(true);
      expect(archiveRes.body.task.id).toBe(taskId);
      expect(archiveRes.body.task.isArchived).toBe(true);
      expect(archiveRes.body.task.status).toBe('ARCHIVED');

      // 3. PostgreSQL database assertion
      const dbTask = await prisma.task.findUnique({
        where: { id: taskId },
      });
      expect(dbTask).not.toBeNull();
      expect(dbTask!.isArchived).toBe(true);
      expect(dbTask!.status).toBe('ARCHIVED');
      expect(dbTask!.archivedAt).not.toBeNull();

      // 4. Activity Event assertion: TASK_ARCHIVED is logged
      const actRes = await request(app)
        .get(`/api/activities?taskId=${taskId}`)
        .set('x-workspace-id', TENANT_A_WORKSPACE_ID);

      expect(actRes.status).toBe(200);
      const activities = actRes.body.activities;
      expect(activities.length).toBeGreaterThanOrEqual(1);

      const archiveEvent = activities.find((a: any) => a.eventType === 'TASK_ARCHIVED');
      expect(archiveEvent).toBeDefined();
      expect(archiveEvent.description).toContain('archived');
      expect(archiveEvent.metadata.newState.isArchived).toBe(true);
    });

    it('4.2: Archived task is excluded from active query and included in ?archived=true filter', async () => {
      // Create and archive task
      const createRes = await request(app)
        .post('/api/tasks')
        .set('x-workspace-id', TENANT_A_WORKSPACE_ID)
        .send({ title: '[CHALLENGER-M5-2] Query Filter Archive Test' });

      const taskId = createRes.body.task.id;
      await request(app).post(`/api/tasks/${taskId}/archive`).set('x-workspace-id', TENANT_A_WORKSPACE_ID);

      // Query active tasks
      const activeRes = await request(app).get('/api/tasks').set('x-workspace-id', TENANT_A_WORKSPACE_ID);
      expect(activeRes.status).toBe(200);
      const inActive = activeRes.body.tasks.some((t: any) => t.id === taskId);
      expect(inActive).toBe(false);

      // Query archived tasks
      const archivedRes = await request(app).get('/api/tasks?archived=true').set('x-workspace-id', TENANT_A_WORKSPACE_ID);
      expect(archivedRes.status).toBe(200);
      const inArchived = archivedRes.body.tasks.some((t: any) => t.id === taskId);
      expect(inArchived).toBe(true);
    });

    it('4.3: POST /api/tasks/:id/restore restores task to TO_DO, sets isArchived: false, and logs TASK_RESTORED', async () => {
      // Create and archive
      const createRes = await request(app)
        .post('/api/tasks')
        .set('x-workspace-id', TENANT_A_WORKSPACE_ID)
        .send({ title: '[CHALLENGER-M5-2] Task to be Restored' });

      const taskId = createRes.body.task.id;
      await request(app).post(`/api/tasks/${taskId}/archive`).set('x-workspace-id', TENANT_A_WORKSPACE_ID);

      // Restore
      const restoreRes = await request(app)
        .post(`/api/tasks/${taskId}/restore`)
        .set('x-workspace-id', TENANT_A_WORKSPACE_ID);

      expect(restoreRes.status).toBe(200);
      expect(restoreRes.body.task.isArchived).toBe(false);
      expect(restoreRes.body.task.status).toBe('TO_DO');

      // Verify database state
      const dbTask = await prisma.task.findUnique({ where: { id: taskId } });
      expect(dbTask!.isArchived).toBe(false);
      expect(dbTask!.status).toBe('TODO');

      // Verify activity logs contain TASK_RESTORED
      const actRes = await request(app)
        .get(`/api/activities?taskId=${taskId}`)
        .set('x-workspace-id', TENANT_A_WORKSPACE_ID);

      const restoreEvent = actRes.body.activities.find((a: any) => a.eventType === 'TASK_RESTORED');
      expect(restoreEvent).toBeDefined();
      expect(restoreEvent.metadata.newState.isArchived).toBe(false);
    });
  });
});
