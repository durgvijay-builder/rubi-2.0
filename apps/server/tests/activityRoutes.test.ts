import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { PRIMARY_WORKSPACE_ID } from '../prisma/seed.js';

describe('Activity Logging API Routes (/api/activity & /api/activities)', () => {
  const workspaceId = PRIMARY_WORKSPACE_ID;

  it('GET /api/activities returns chronological activity events for workspace', async () => {
    const res = await request(app)
      .get('/api/activities')
      .set('x-workspace-id', workspaceId);

    expect(res.status).toBe(200);
    expect(res.body.activities).toBeDefined();
    expect(Array.isArray(res.body.activities)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });

  it('GET /api/activity also works as alias for /api/activities', async () => {
    const res = await request(app)
      .get('/api/activity')
      .set('x-workspace-id', workspaceId);

    expect(res.status).toBe(200);
    expect(res.body.activities).toBeDefined();
    expect(Array.isArray(res.body.activities)).toBe(true);
  });

  it('Activity events capture TASK_CREATED, TASK_APPROVED, and TASK_STATUS_CHANGED correctly', async () => {
    // 1. Create a task via approve
    const approveRes = await request(app)
      .post('/api/tasks/approve')
      .set('x-workspace-id', workspaceId)
      .send({
        tasks: [
          {
            tempId: 'temp-activity-test',
            title: 'Verify Activity Feed Logging',
            owner: 'Auditor',
            priority: 'MEDIUM',
          },
        ],
      });

    expect(approveRes.status).toBe(201);
    const createdTask = approveRes.body.tasks[0];

    // 2. Change status
    await request(app)
      .patch(`/api/tasks/${createdTask.id}`)
      .set('x-workspace-id', workspaceId)
      .send({ status: 'IN_PROGRESS' });

    // 3. Query activities
    const actRes = await request(app)
      .get(`/api/activities?taskId=${createdTask.id}`)
      .set('x-workspace-id', workspaceId);

    expect(actRes.status).toBe(200);
    const events = actRes.body.activities;

    const hasCreated = events.some((e: any) => e.eventType === 'TASK_CREATED');
    const hasApproved = events.some((e: any) => e.eventType === 'TASK_APPROVED');
    const hasStatusChanged = events.some((e: any) => e.eventType === 'TASK_STATUS_CHANGED');

    expect(hasCreated).toBe(true);
    expect(hasApproved).toBe(true);
    expect(hasStatusChanged).toBe(true);
  });
});
