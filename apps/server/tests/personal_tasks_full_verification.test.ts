import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { prisma } from '../src/db.js';
import { PRIMARY_WORKSPACE_ID } from '../prisma/seed.js';
import {
  resolveZonedRelativeDate,
  extractMultipleTimesFromPhrase,
  zonedTimeToUtc,
  getZonedDateParts,
} from '@rubi/shared';
import { reminderService } from '../src/services/reminderService.js';

describe('Personal Task Management Upgrade & Production Readiness (Comprehensive)', () => {
  const workspaceId = PRIMARY_WORKSPACE_ID;

  // ── PHASE 2 & 5: DATA MODEL, CRUD & PERMANENT DELETE WITH AUDIT SNAPSHOT ──────
  describe('Phase 2 & 5: Personal Task Data Model, Subtasks & Permanent Delete', () => {
    let createdTaskId: string;

    it('creates a personal task with categories, effort, slot, schedule, and subtasks without requiring assignees', async () => {
      const payload = {
        title: 'Machine learning deep learning chapter 4',
        description: 'Implement backprop and gradient descent in PyTorch',
        priority: 'HIGH',
        effort: 'LARGE',
        slot: 'After College',
        categories: ['College', 'Self learning'],
        schedule: '2026-11-09T11:30:00.000Z', // 5 PM in Asia/Kolkata
        deadline: '2026-11-12T12:30:00.000Z',  // 6 PM in Asia/Kolkata
        reminderTime: '2026-11-09T11:15:00.000Z', // 15 mins before
        subtasks: [
          { title: 'Read notes on matrix calculus', isCompleted: false, order: 0 },
          { title: 'Write tensor multiplication unit tests', isCompleted: false, order: 1 },
        ],
      };

      const res = await request(app)
        .post('/api/tasks')
        .set('x-workspace-id', workspaceId)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.task).toBeDefined();

      const task = res.body.task;
      createdTaskId = task.id;

      expect(task.title).toBe(payload.title);
      expect(task.effort).toBe('LARGE');
      expect(task.slot).toBe('After College');
      expect(task.categories).toEqual(expect.arrayContaining(['College', 'Self learning']));
      expect(task.schedule).toBe(payload.schedule);
      expect(task.deadline).toBe(payload.deadline);
      expect(task.reminderTime).toBe(payload.reminderTime);
      expect(task.assignee).toBeNull(); // No assignee required or auto-created!
      expect(task.subtasks.length).toBe(2);
      expect(task.subtasks[0].title).toBe('Read notes on matrix calculus');
      expect(task.subtasks[0].isCompleted).toBe(false);

      // Verify persistent reminder record in PostgreSQL
      const reminder = await prisma.reminder.findFirst({
        where: { taskId: task.id },
      });
      expect(reminder).not.toBeNull();
      expect(reminder?.status).toBe('PENDING');
      expect(reminder?.remindAt.toISOString()).toBe(payload.reminderTime);
    });

    it('subtask lifecycle: adds a new subtask, toggles completion, and removes subtask', async () => {
      expect(createdTaskId).toBeDefined();

      // 1. Add subtask
      const addRes = await request(app)
        .post(`/api/tasks/${createdTaskId}/subtasks`)
        .set('x-workspace-id', workspaceId)
        .send({ title: 'Run GPU training script', order: 2 });

      expect(addRes.status).toBe(201);
      expect(addRes.body.subtask).toBeDefined();
      expect(addRes.body.subtask.title).toBe('Run GPU training script');
      const newSubtaskId = addRes.body.subtask.id;

      // 2. Toggle completion
      const patchRes = await request(app)
        .patch(`/api/tasks/${createdTaskId}/subtasks/${newSubtaskId}`)
        .set('x-workspace-id', workspaceId)
        .send({ isCompleted: true });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.subtask.isCompleted).toBe(true);

      // 3. Delete subtask
      const delRes = await request(app)
        .delete(`/api/tasks/${createdTaskId}/subtasks/${newSubtaskId}`)
        .set('x-workspace-id', workspaceId);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      // Verify subtask is gone
      const checkSubtask = await prisma.subtask.findUnique({
        where: { id: newSubtaskId },
      });
      expect(checkSubtask).toBeNull();
    });

    it('permanent delete atomically logs TASK_DELETED activity snapshot and removes record', async () => {
      expect(createdTaskId).toBeDefined();

      // Permanent delete
      const delRes = await request(app)
        .delete(`/api/tasks/${createdTaskId}?permanent=true`)
        .set('x-workspace-id', workspaceId);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
      expect(delRes.body.message).toContain('permanently deleted');

      // Verify task no longer exists in DB
      const checkTask = await prisma.task.findUnique({
        where: { id: createdTaskId },
      });
      expect(checkTask).toBeNull();

      // Verify dependent subtasks and reminders were cleanly cascade deleted
      const checkReminders = await prisma.reminder.findMany({
        where: { taskId: createdTaskId },
      });
      expect(checkReminders.length).toBe(0);

      // Verify ActivityEvent TASK_DELETED was recorded with snapshot
      const deleteActivity = await prisma.activityEvent.findFirst({
        where: {
          workspaceId,
          eventType: 'TASK_DELETED',
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(deleteActivity).not.toBeNull();
      expect(deleteActivity?.description).toContain('permanently deleted');
      const metadata = deleteActivity?.metadata as any;
      expect(metadata?.deletedTaskId).toBe(createdTaskId);
      expect(metadata?.snapshot?.title).toBe('Machine learning deep learning chapter 4');
      expect(metadata?.snapshot?.effort).toBe('LARGE');
      expect(metadata?.snapshot?.slot).toBe('After College');
      expect(metadata?.snapshot?.categories).toEqual(expect.arrayContaining(['College', 'Self learning']));
    });
  });

  // ── PHASE 3: TIMEZONE CONVERSION ACCURACY & MULTI-SESSION SPLIT ───────────────
  describe('Phase 3: Timezone Precision (Asia/Kolkata default & IANA DST)', () => {
    it('converts relative expressions to UTC correctly in Asia/Kolkata (UTC+5:30)', () => {
      // Fixed base date: Monday, Nov 9, 2026, 08:00 UTC (1:30 PM in Asia/Kolkata)
      const baseDate = new Date('2026-11-09T08:00:00.000Z');

      // 1. "tomorrow at 5 PM" in Asia/Kolkata -> Tuesday Nov 10, 17:00 local = 11:30 UTC
      const tomorrow5pm = resolveZonedRelativeDate('tomorrow at 5 PM', baseDate, 'Asia/Kolkata');
      expect(tomorrow5pm).not.toBeNull();
      const d1 = new Date(tomorrow5pm!);
      expect(d1.toISOString()).toBe('2026-11-10T11:30:00.000Z');
      expect(d1.getUTCHours()).toBe(11);
      expect(d1.getUTCMinutes()).toBe(30);

      // 2. "tomorrow at 7 PM" in Asia/Kolkata -> Tuesday Nov 10, 19:00 local = 13:30 UTC
      const tomorrow7pm = resolveZonedRelativeDate('tomorrow at 7 PM', baseDate, 'Asia/Kolkata');
      expect(tomorrow7pm).not.toBeNull();
      const d2 = new Date(tomorrow7pm!);
      expect(d2.toISOString()).toBe('2026-11-10T13:30:00.000Z');

      // 3. "tomorrow at 5:30 PM" in Asia/Kolkata -> 17:30 local = 12:00 UTC
      const tomorrow530pm = resolveZonedRelativeDate('tomorrow at 5:30 PM', baseDate, 'Asia/Kolkata');
      expect(tomorrow530pm).not.toBeNull();
      const d3 = new Date(tomorrow530pm!);
      expect(d3.toISOString()).toBe('2026-11-10T12:00:00.000Z');

      // 4. "next Monday at 10 AM" in Asia/Kolkata -> Monday Nov 16, 10:00 local = 04:30 UTC
      const nextMon10am = resolveZonedRelativeDate('next Monday at 10 AM', baseDate, 'Asia/Kolkata');
      expect(nextMon10am).not.toBeNull();
      const d4 = new Date(nextMon10am!);
      expect(d4.toISOString()).toBe('2026-11-16T04:30:00.000Z');

      // 5. "Friday at 4 PM" in Asia/Kolkata -> Friday Nov 13, 16:00 local = 10:30 UTC
      const friday4pm = resolveZonedRelativeDate('Friday at 4 PM', baseDate, 'Asia/Kolkata');
      expect(friday4pm).not.toBeNull();
      const d5 = new Date(friday4pm!);
      expect(d5.toISOString()).toBe('2026-11-13T10:30:00.000Z');

      // 6. "today at 11 PM" in Asia/Kolkata -> Monday Nov 9, 23:00 local = 17:30 UTC
      const today11pm = resolveZonedRelativeDate('today at 11 PM', baseDate, 'Asia/Kolkata');
      expect(today11pm).not.toBeNull();
      const d6 = new Date(today11pm!);
      expect(d6.toISOString()).toBe('2026-11-09T17:30:00.000Z');
    });

    it('extracts multi-session times: "tomorrow at 5 and 7 PM" parses into 2 distinct work sessions', () => {
      const phrase = 'Schedule a task for machine learning tomorrow at 5 and 7 PM';
      const times = extractMultipleTimesFromPhrase(phrase);

      expect(times.length).toBe(2);
      expect(times[0].hour).toBe(17); // 5 PM
      expect(times[0].minute).toBe(0);
      expect(times[1].hour).toBe(19); // 7 PM
      expect(times[1].minute).toBe(0);
    });
  });

  // ── PHASE 4: PERSISTENT REMINDER SYSTEM & SCHEDULER ───────────────────────────
  describe('Phase 4: Reminder Scheduler & Persistence', () => {
    it('schedules a reminder in PostgreSQL and scheduler processes it without duplicate deliveries', async () => {
      // Create a task with an immediate past reminder time to trigger delivery
      const immediatePast = new Date(Date.now() - 5000);

      const createdTask = await prisma.task.create({
        data: {
          workspaceId,
          title: 'Immediate reminder test task',
          status: 'TODO',
          priority: 'MEDIUM',
          reminderTime: immediatePast,
        },
      });

      const reminder = await prisma.reminder.create({
        data: {
          taskId: createdTask.id,
          remindAt: immediatePast,
          type: 'custom',
          status: 'PENDING',
          message: 'Time to review math notes!',
        },
      });

      // Run reminder scheduler cycle
      const processedCount = await reminderService.checkDueReminders();
      expect(processedCount).toBeGreaterThanOrEqual(1);

      // Verify reminder status transitioned to DELIVERED with deliveredAt timestamp
      const updatedReminder = await prisma.reminder.findUnique({
        where: { id: reminder.id },
      });

      expect(updatedReminder?.status).toBe('DELIVERED');
      expect(updatedReminder?.deliveredAt).not.toBeNull();

      // Second check must not deliver the same reminder twice (deduplication)
      const secondCheckCount = await reminderService.checkDueReminders();
      const checkAgain = await prisma.reminder.findUnique({
        where: { id: reminder.id },
      });
      expect(checkAgain?.deliveredAt?.getTime()).toBe(updatedReminder?.deliveredAt?.getTime());

      // Query via due reminders API endpoint
      const dueRes = await request(app)
        .get('/api/reminders/due')
        .set('x-workspace-id', workspaceId);

      expect(dueRes.status).toBe(200);
      expect(dueRes.body.success).toBe(true);
      expect(Array.isArray(dueRes.body.reminders)).toBe(true);
      const foundInApi = dueRes.body.reminders.find((r: any) => r.id === reminder.id);
      expect(foundInApi).toBeDefined();
      expect(foundInApi.taskTitle).toBe('Immediate reminder test task');

      // Cleanup
      await prisma.reminder.delete({ where: { id: reminder.id } });
      await prisma.task.delete({ where: { id: createdTask.id } });
    });
  });

  // ── PHASE 8: NEAREST DEADLINE SORTING & VIEW SEGMENTS ─────────────────────────
  describe('Phase 8: Nearest Deadline Sorting & Personal View Filters', () => {
    let tOverdueId: string;
    let tNearId: string;
    let tFarId: string;
    let tUndatedId: string;

    beforeAll(async () => {
      const now = Date.now();

      // 1. Overdue task (yesterday)
      const tOverdue = await prisma.task.create({
        data: {
          workspaceId,
          title: 'SortTest Overdue Task',
          status: 'TODO',
          priority: 'LOW',
          deadline: new Date(now - 24 * 60 * 60 * 1000),
          categories: ['College'],
        },
      });
      tOverdueId = tOverdue.id;

      // 2. Near future task (tomorrow)
      const tNear = await prisma.task.create({
        data: {
          workspaceId,
          title: 'SortTest Near Task',
          status: 'TODO',
          priority: 'MEDIUM',
          deadline: new Date(now + 24 * 60 * 60 * 1000),
          categories: ['Self learning'],
        },
      });
      tNearId = tNear.id;

      // 3. Far future task (next week)
      const tFar = await prisma.task.create({
        data: {
          workspaceId,
          title: 'SortTest Far Task',
          status: 'TODO',
          priority: 'CRITICAL',
          deadline: new Date(now + 7 * 24 * 60 * 60 * 1000),
          categories: ['Side hustle'],
        },
      });
      tFarId = tFar.id;

      // 4. Undated task
      const tUndated = await prisma.task.create({
        data: {
          workspaceId,
          title: 'SortTest Undated Task',
          status: 'TODO',
          priority: 'HIGH',
          deadline: null,
          categories: ['Channel'],
        },
      });
      tUndatedId = tUndated.id;
    });

    it('GET /api/tasks orders active tasks with nearest deadline first (overdue > near > far > undated)', async () => {
      const res = await request(app)
        .get('/api/tasks?search=SortTest')
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body.tasks.length).toBe(4);

      const titles = res.body.tasks.map((t: any) => t.title);
      expect(titles[0]).toBe('SortTest Overdue Task'); // Overdue is first!
      expect(titles[1]).toBe('SortTest Near Task');    // Near future is second!
      expect(titles[2]).toBe('SortTest Far Task');     // Far future is third!
      expect(titles[3]).toBe('SortTest Undated Task');  // Undated comes last!
    });

    it('GET /api/tasks?category=College filters by category accurately', async () => {
      const res = await request(app)
        .get('/api/tasks?category=College&search=SortTest')
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body.tasks.length).toBe(1);
      expect(res.body.tasks[0].title).toBe('SortTest Overdue Task');
    });

    it('GET /api/tasks?view=OVERDUE returns only overdue active tasks', async () => {
      const res = await request(app)
        .get('/api/tasks?view=OVERDUE&search=SortTest')
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body.tasks.length).toBe(1);
      expect(res.body.tasks[0].title).toBe('SortTest Overdue Task');
    });

    // Cleanup
    afterAll(async () => {
      await prisma.task.deleteMany({
        where: { id: { in: [tOverdueId, tNearId, tFarId, tUndatedId] } },
      });
    });
  });

  // ── CATEGORIES & USER SETTINGS CRUD ───────────────────────────────────────────
  describe('Personal Categories & User Settings API', () => {
    it('manages personal categories: lists default categories, creates custom, and deletes custom', async () => {
      // 1. List categories
      const listRes = await request(app)
        .get('/api/categories')
        .set('x-workspace-id', workspaceId);

      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      const names = listRes.body.categories.map((c: any) => c.name);
      expect(names).toEqual(expect.arrayContaining(['College', 'Self learning', 'Side hustle', 'Channel', 'Ghar ka!']));

      // 2. Create custom category
      const createRes = await request(app)
        .post('/api/categories')
        .set('x-workspace-id', workspaceId)
        .send({ name: 'Placement Prep', color: '#10b981' });

      expect(createRes.status).toBe(201);
      expect(createRes.body.category.name).toBe('Placement Prep');
      const catId = createRes.body.category.id;

      // 3. Delete custom category
      const delRes = await request(app)
        .delete(`/api/categories/${catId}`)
        .set('x-workspace-id', workspaceId);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
    });

    it('manages user settings: retrieves and updates timezone preference', async () => {
      // 1. Get settings
      const getRes = await request(app)
        .get('/api/user-settings')
        .set('x-workspace-id', workspaceId);

      expect(getRes.status).toBe(200);
      expect(getRes.body.settings.timezone).toBeDefined();

      // 2. Update settings
      const patchRes = await request(app)
        .patch('/api/user-settings')
        .set('x-workspace-id', workspaceId)
        .send({ timezone: 'Asia/Kolkata' });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.settings.timezone).toBe('Asia/Kolkata');

      // 3. Rejects invalid timezone
      const badTzRes = await request(app)
        .patch('/api/user-settings')
        .set('x-workspace-id', workspaceId)
        .send({ timezone: 'Invalid/City_Nowhere' });

      expect(badTzRes.status).toBe(400);
    });
  });
});
