import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '../src/db.js';
import { routineService } from '../src/services/routineService.js';
import { reminderService } from '../src/services/reminderService.js';
import { taskService } from '../src/services/taskService.js';
import { ReminderStatus } from '@prisma/client';

describe('Module Two (Routines) & Module Three (Reminders) & Customization Freedom', () => {
  const TEST_WORKSPACE_ID = 'ws-routine-custom-test-' + Date.now();
  let createdRoutineIds: string[] = [];
  let createdTaskIds: string[] = [];

  beforeEach(async () => {
    await prisma.workspace.upsert({
      where: { id: TEST_WORKSPACE_ID },
      update: {},
      create: {
        id: TEST_WORKSPACE_ID,
        name: 'Routine & Customization Test Workspace',
        slug: `routine-test-${Date.now()}`,
      },
    });
  });

  afterEach(async () => {
    // Clean up routines and tasks
    for (const rId of createdRoutineIds) {
      await prisma.routine.deleteMany({ where: { id: rId } });
    }
    for (const tId of createdTaskIds) {
      await prisma.task.deleteMany({ where: { id: tId } });
    }
    await prisma.workspace.deleteMany({ where: { id: TEST_WORKSPACE_ID } });
    createdRoutineIds = [];
    createdTaskIds = [];
  });

  it('creates daily and weekly recurring routines with flexible recurrence schedules', async () => {
    // 1. Daily routine: Exercise on Mon-Sat (1,2,3,4,5,6)
    const exercise = await routineService.createRoutine(TEST_WORKSPACE_ID, {
      title: 'Morning Exercise & Cycling',
      description: 'Cardio and stretching',
      category: 'Ghar ka!',
      frequency: 'DAILY',
      daysOfWeek: [1, 2, 3, 4, 5, 6],
      slot: 'Morning',
      time: '06:30',
      isActive: true,
      reminderTime: '15 mins before',
    });

    expect(exercise.id).toBeDefined();
    expect(exercise.title).toBe('Morning Exercise & Cycling');
    expect(exercise.daysOfWeek).toEqual([1, 2, 3, 4, 5, 6]);
    expect(exercise.frequency).toBe('DAILY');
    expect(exercise.time).toBe('06:30');
    createdRoutineIds.push(exercise.id);

    // 2. Weekly routine: Revision on Sundays (7)
    const revision = await routineService.createRoutine(TEST_WORKSPACE_ID, {
      title: 'Weekly Revision & Planning',
      description: 'Review weekly goals',
      category: 'Self learning',
      frequency: 'WEEKLY',
      daysOfWeek: [7],
      slot: 'Night',
      time: '20:00',
      targetPerWeek: 1,
      isActive: true,
    });

    expect(revision.id).toBeDefined();
    expect(revision.frequency).toBe('WEEKLY');
    expect(revision.targetPerWeek).toBe(1);
    createdRoutineIds.push(revision.id);

    // List routines
    const routines = await routineService.getRoutines(TEST_WORKSPACE_ID);
    expect(routines.length).toBe(2);
  });

  it('tracks routine occurrences: completion, undo, skipping, and weekly progress', async () => {
    const routine = await routineService.createRoutine(TEST_WORKSPACE_ID, {
      title: 'Daily Python Practice',
      category: 'College',
      frequency: 'DAILY',
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      slot: 'Evening',
      time: '18:00',
    });
    createdRoutineIds.push(routine.id);

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // 1. Mark today's occurrence complete
    const added = await routineService.toggleOccurrence(
      TEST_WORKSPACE_ID,
      routine.id,
      todayStr,
      'COMPLETED',
      'Completed 3 LeetCode problems'
    );
    expect(added.action).toBe('added');
    expect(added.occurrence?.status).toBe('COMPLETED');
    expect(added.occurrence?.notes).toBe('Completed 3 LeetCode problems');

    // Verify routine now reflects completedToday
    const fetched = await routineService.getRoutineById(TEST_WORKSPACE_ID, routine.id);
    expect(fetched?.completedToday).toBe(true);

    // 2. Mark yesterday as skipped
    const skipped = await routineService.toggleOccurrence(
      TEST_WORKSPACE_ID,
      routine.id,
      yesterdayStr,
      'SKIPPED'
    );
    expect(skipped.action).toBe('added');
    expect(skipped.occurrence?.status).toBe('SKIPPED');

    // 3. Query weekly occurrences
    const weekOccurrences = await routineService.getOccurrencesForRange(
      TEST_WORKSPACE_ID,
      '2026-11-01',
      todayStr
    );
    expect(weekOccurrences.length).toBe(2);

    // 4. Undo today's completion (toggle off)
    const undone = await routineService.toggleOccurrence(
      TEST_WORKSPACE_ID,
      routine.id,
      todayStr,
      'COMPLETED'
    );
    expect(undone.action).toBe('removed');

    // Verify today is no longer completed
    const updated = await routineService.getRoutineById(TEST_WORKSPACE_ID, routine.id);
    expect(updated?.completedToday).toBe(false);
  });

  it('preserves occurrence history when routine definition or schedule changes', async () => {
    const routine = await routineService.createRoutine(TEST_WORKSPACE_ID, {
      title: 'Daily Reading',
      frequency: 'DAILY',
      daysOfWeek: [1, 2, 3, 4, 5],
    });
    createdRoutineIds.push(routine.id);

    // Complete an occurrence
    await routineService.toggleOccurrence(TEST_WORKSPACE_ID, routine.id, '2026-11-05', 'COMPLETED');

    // Modify schedule to weekends only
    const updated = await routineService.updateRoutine(TEST_WORKSPACE_ID, routine.id, {
      title: 'Daily Reading (Updated Schedule)',
      daysOfWeek: [6, 7],
    });
    expect(updated?.title).toBe('Daily Reading (Updated Schedule)');
    expect(updated?.daysOfWeek).toEqual([6, 7]);

    // Verify historical occurrence is preserved intact
    const history = await routineService.getOccurrencesForRange(
      TEST_WORKSPACE_ID,
      '2026-11-01',
      '2026-11-07'
    );
    expect(history.length).toBe(1);
    expect(history[0].date).toBe('2026-11-05');
  });

  it('provides customization freedom: custom slots, custom reminder preferences, and category styling', async () => {
    // 1. User Settings Customization: Custom Slots & Reminder Defaults
    const updatedSettings = await taskService.updateUserSettings(TEST_WORKSPACE_ID, {
      timezone: 'Asia/Kolkata',
      customSlots: ['Deep Work', 'Evening Workout', 'Late Night Coding'],
      defaultScheduleReminderTime: '08:30',
      defaultDeadlineReminderDaysBefore: 3,
      defaultDeadlineReminderTime: '10:00',
      autoScheduleReminder: true,
      autoDeadlineReminder: true,
    });

    expect(updatedSettings.customSlots).toEqual(['Deep Work', 'Evening Workout', 'Late Night Coding']);
    expect(updatedSettings.defaultScheduleReminderTime).toBe('08:30');
    expect(updatedSettings.defaultDeadlineReminderDaysBefore).toBe(3);
    expect(updatedSettings.defaultDeadlineReminderTime).toBe('10:00');

    // 2. Custom Category Management with Colors
    const customCat = await taskService.createCategory(TEST_WORKSPACE_ID, 'Robotics Research', '#10b981');
    expect(customCat.name).toBe('Robotics Research');
    expect(customCat.color).toBe('#10b981');

    // Update Category color & name
    const editedCat = await taskService.updateCategory(TEST_WORKSPACE_ID, customCat.id, {
      name: 'Robotics & Hardware',
      color: '#06b6d4',
    });
    expect(editedCat?.name).toBe('Robotics & Hardware');
    expect(editedCat?.color).toBe('#06b6d4');

    // 3. Routine Reminders Integration
    const routine = await routineService.createRoutine(TEST_WORKSPACE_ID, {
      title: 'Night Revision',
      frequency: 'DAILY',
      time: '21:00',
    });
    createdRoutineIds.push(routine.id);

    const reminder = await reminderService.createReminder(TEST_WORKSPACE_ID, {
      routineId: routine.id,
      remindAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      message: 'Time for night revision',
      type: 'routine',
    });

    expect(reminder.routineId).toBe(routine.id);
    expect(reminder.type).toBe('routine');
    expect(reminder.status).toBe(ReminderStatus.PENDING);

    // List reminders for routine
    const routineReminders = await reminderService.getReminders(TEST_WORKSPACE_ID, {
      routineId: routine.id,
    });
    expect(routineReminders.length).toBe(1);
    expect(routineReminders[0].routine?.title).toBe('Night Revision');

    // Clean up reminder
    await reminderService.deleteReminder(TEST_WORKSPACE_ID, reminder.id);
  });
});

