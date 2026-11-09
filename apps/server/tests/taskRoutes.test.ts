import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { PRIMARY_WORKSPACE_ID } from '../prisma/seed.js';

describe('Task Management API Routes (/api/tasks)', () => {
  const workspaceId = PRIMARY_WORKSPACE_ID;

  it('GET /api/tasks returns authorized active tasks mapped with status TO_DO', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .set('x-workspace-id', workspaceId);

    expect(res.status).toBe(200);
    expect(res.body.tasks).toBeDefined();
    expect(Array.isArray(res.body.tasks)).toBe(true);
    expect(res.body.tasks.length).toBeGreaterThanOrEqual(1);

    // Verify status mapping: TODO in DB -> TO_DO in API response
    const todoTask = res.body.tasks.find((t: any) => t.id === 'task-seed-2');
    expect(todoTask).toBeDefined();
    expect(todoTask.status).toBe('TO_DO');
    expect(todoTask.workspaceId).toBe(workspaceId);
  });

  it('GET /api/tasks?archived=true returns only archived tasks', async () => {
    const res = await request(app)
      .get('/api/tasks?archived=true')
      .set('x-workspace-id', workspaceId);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tasks)).toBe(true);
    for (const task of res.body.tasks) {
      expect(task.isArchived).toBe(true);
    }
  });

  it('TC-BOUND-04: POST /api/tasks/approve-all rejects circular dependency with HTTP 422', async () => {
    const circularBatch = {
      tasks: [
        {
          tempId: 'task-cycle-a',
          title: 'Task Alpha (Circular)',
          priority: 'HIGH',
          dependencies: ['task-cycle-b'],
        },
        {
          tempId: 'task-cycle-b',
          title: 'Task Beta (Circular)',
          priority: 'HIGH',
          dependencies: ['task-cycle-a'],
        },
      ],
    };

    const res = await request(app)
      .post('/api/tasks/approve-all')
      .set('x-workspace-id', workspaceId)
      .send(circularBatch);

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('Unprocessable Entity');
    expect(res.body.message).toContain('circular dependency unresolved');
  });

  it('POST /api/tasks/approve-all commits valid tasks atomically into database', async () => {
    const validBatch = {
      tasks: [
        {
          tempId: 'temp-task-parent',
          title: 'Setup PostgreSQL Database Cluster',
          owner: 'Durgvijay',
          priority: 'CRITICAL',
          dependencies: [],
        },
        {
          tempId: 'temp-task-child',
          title: 'Configure Prisma Schema Migrations',
          owner: 'Sarah',
          priority: 'HIGH',
          dependencies: ['temp-task-parent'],
        },
      ],
    };

    const res = await request(app)
      .post('/api/tasks/approve-all')
      .set('x-workspace-id', workspaceId)
      .send(validBatch);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.tasks).toHaveLength(2);

    const parent = res.body.tasks.find((t: any) => t.title.includes('PostgreSQL Database Cluster'));
    const child = res.body.tasks.find((t: any) => t.title.includes('Prisma Schema Migrations'));

    expect(parent).toBeDefined();
    expect(parent.status).toBe('TO_DO');

    expect(child).toBeDefined();
    expect(child.status).toBe('BLOCKED');
    expect(child.dependencies).toContain(parent.id);
  });

  it('POST /api/tasks creates a single task or processes direct batch', async () => {
    const singleTask = {
      title: 'Individual Unit Test Task',
      owner: 'Alex',
      priority: 'MEDIUM',
    };

    const res = await request(app)
      .post('/api/tasks')
      .set('x-workspace-id', workspaceId)
      .send(singleTask);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.task.title).toBe('Individual Unit Test Task');
    expect(res.body.task.status).toBe('TO_DO');
    expect(res.body.task.assignee).toBe('Alex');
  });

  it('PATCH /api/tasks/:id updates status and executes automated unblocking cascade', async () => {
    // 1. Create two chained tasks: Prerequisite -> Dependent
    const batchRes = await request(app)
      .post('/api/tasks/approve-all')
      .set('x-workspace-id', workspaceId)
      .send({
        tasks: [
          {
            tempId: 'chain-prereq',
            title: 'Build Audio Streaming Engine',
            priority: 'HIGH',
            dependencies: [],
          },
          {
            tempId: 'chain-dependent',
            title: 'Verify Spoken Confirmation Playback',
            priority: 'HIGH',
            dependencies: ['chain-prereq'],
          },
        ],
      });

    expect(batchRes.status).toBe(201);
    const prereq = batchRes.body.tasks.find((t: any) => t.title === 'Build Audio Streaming Engine');
    const dependent = batchRes.body.tasks.find((t: any) => t.title === 'Verify Spoken Confirmation Playback');

    expect(prereq.status).toBe('TO_DO');
    expect(dependent.status).toBe('BLOCKED');

    // 2. Mark prerequisite as COMPLETED
    const patchRes = await request(app)
      .patch(`/api/tasks/${prereq.id}`)
      .set('x-workspace-id', workspaceId)
      .send({ status: 'COMPLETED' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.task.status).toBe('COMPLETED');

    // 3. Verify dependent task has cascaded from BLOCKED to TO_DO
    const listRes = await request(app)
      .get('/api/tasks')
      .set('x-workspace-id', workspaceId);

    const updatedDependent = listRes.body.tasks.find((t: any) => t.id === dependent.id);
    expect(updatedDependent).toBeDefined();
    expect(updatedDependent.status).toBe('TO_DO');
  });

  it('POST /api/tasks/:id/archive and /restore performs soft archival without data loss', async () => {
    // Create task
    const createRes = await request(app)
      .post('/api/tasks')
      .set('x-workspace-id', workspaceId)
      .send({ title: 'Task to be archived and restored' });

    const taskId = createRes.body.task.id;

    // Archive
    const archiveRes = await request(app)
      .post(`/api/tasks/${taskId}/archive`)
      .set('x-workspace-id', workspaceId);

    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.task.isArchived).toBe(true);

    // Verify hidden from default query
    const activeRes = await request(app)
      .get('/api/tasks')
      .set('x-workspace-id', workspaceId);
    expect(activeRes.body.tasks.some((t: any) => t.id === taskId)).toBe(false);

    // Restore
    const restoreRes = await request(app)
      .post(`/api/tasks/${taskId}/restore`)
      .set('x-workspace-id', workspaceId);

    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.task.isArchived).toBe(false);
    expect(restoreRes.body.task.status).toBe('TO_DO');
  });

  it('GET /api/tasks/:id/dependencies returns prerequisite and dependent graph', async () => {
    const listRes = await request(app)
      .get('/api/tasks')
      .set('x-workspace-id', workspaceId);

    const firstTask = listRes.body.tasks[0];
    const depRes = await request(app)
      .get(`/api/tasks/${firstTask.id}/dependencies`)
      .set('x-workspace-id', workspaceId);

    expect(depRes.status).toBe(200);
    expect(depRes.body.taskId).toBe(firstTask.id);
    expect(Array.isArray(depRes.body.prerequisites)).toBe(true);
    expect(Array.isArray(depRes.body.dependents)).toBe(true);
    expect(typeof depRes.body.isBlocked).toBe('boolean');
  });
});
