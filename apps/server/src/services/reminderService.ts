import { EventEmitter } from 'node:events';
import { prisma } from '../db.js';
import { ReminderStatus, type Reminder } from '@prisma/client';

export interface DueReminderNotification {
  id: string;
  taskId: string | null;
  taskTitle?: string;
  routineId: string | null;
  title: string;
  workspaceId: string;
  remindAt: string;
  message: string;
  deliveredAt: string;
  type: string;
}

export class ReminderService extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private recentDeliveredQueue: DueReminderNotification[] = [];

  constructor() {
    super();
  }

  /**
   * Starts periodic polling for due reminders. Pending reminders survive restarts.
   */
  startScheduler(intervalMs = 10000): void {
    if (this.timer) return;

    this.timer = setInterval(() => {
      this.checkDueReminders().catch((err) => {
        console.error('[ReminderService] Error checking due reminders:', err.message);
      });
    }, intervalMs);

    // Initial check on startup
    this.checkDueReminders().catch((err) => {
      console.error('[ReminderService] Initial due check error:', err.message);
    });
  }

  /**
   * Stops the background scheduler.
   */
  stopScheduler(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Checks PostgreSQL for due reminders and marks them DELIVERED atomically.
   * Multi-instance safe via atomic updateMany status check.
   */
  async checkDueReminders(): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      const now = new Date();

      const dueReminders = await prisma.reminder.findMany({
        where: {
          status: ReminderStatus.PENDING,
          remindAt: { lte: now },
        },
        include: {
          task: {
            select: {
              id: true,
              title: true,
              workspaceId: true,
              status: true,
              isArchived: true,
            },
          },
          routine: {
            select: {
              id: true,
              title: true,
              workspaceId: true,
              isActive: true,
            },
          },
        },
        take: 50,
      });

      if (dueReminders.length === 0) return 0;

      let deliveredCount = 0;

      for (const item of dueReminders) {
        // If task is completed or archived, cancel instead of delivering
        if (item.task && (item.task.status === 'COMPLETED' || item.task.isArchived)) {
          await prisma.reminder.update({
            where: { id: item.id },
            data: { status: ReminderStatus.CANCELLED },
          });
          continue;
        }

        // If routine is inactive, cancel
        if (item.routine && !item.routine.isActive) {
          await prisma.reminder.update({
            where: { id: item.id },
            data: { status: ReminderStatus.CANCELLED },
          });
          continue;
        }

        // Atomic claim: only update if status is still PENDING
        const updateResult = await prisma.reminder.updateMany({
          where: {
            id: item.id,
            status: ReminderStatus.PENDING,
          },
          data: {
            status: ReminderStatus.DELIVERED,
            deliveredAt: new Date(),
          },
        });

        // Another scheduler claimed it
        if (updateResult.count === 0) continue;

        const title = item.task?.title || item.routine?.title || 'Personal Item';
        const workspaceId = item.task?.workspaceId || item.routine?.workspaceId || '';

        const notification: DueReminderNotification = {
          id: item.id,
          taskId: item.taskId,
          taskTitle: title,
          routineId: item.routineId,
          title,
          workspaceId,
          remindAt: item.remindAt.toISOString(),
          message: item.message || (item.task ? `Reminder for task: "${title}"` : `Routine reminder: "${title}"`),
          deliveredAt: new Date().toISOString(),
          type: item.type,
        };

        this.recentDeliveredQueue.unshift(notification);
        if (this.recentDeliveredQueue.length > 100) {
          this.recentDeliveredQueue.pop();
        }

        this.emit('reminder_due', notification);
        deliveredCount++;
      }

      return deliveredCount;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Retrieves delivered or pending reminders for in-app notifications / bell.
   */
  async getDueReminders(workspaceId: string): Promise<DueReminderNotification[]> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const deliveredDbReminders = await prisma.reminder.findMany({
      where: {
        OR: [
          { task: { workspaceId } },
          { routine: { workspaceId } },
        ],
        status: ReminderStatus.DELIVERED,
        deliveredAt: { gte: oneDayAgo },
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            workspaceId: true,
          },
        },
        routine: {
          select: {
            id: true,
            title: true,
            workspaceId: true,
          },
        },
      },
      orderBy: { deliveredAt: 'desc' },
      take: 30,
    });

    return deliveredDbReminders.map((r) => {
      const title = r.task?.title || r.routine?.title || 'Personal Item';
      const ws = r.task?.workspaceId || r.routine?.workspaceId || workspaceId;

      return {
        id: r.id,
        taskId: r.taskId,
        taskTitle: title,
        routineId: r.routineId,
        title,
        workspaceId: ws,
        remindAt: r.remindAt.toISOString(),
        message: r.message || `Reminder: "${title}"`,
        deliveredAt: r.deliveredAt ? r.deliveredAt.toISOString() : new Date().toISOString(),
        type: r.type,
      };
    });
  }

  /**
   * Lists all reminders for a workspace with optional filters.
   */
  async getReminders(
    workspaceId: string,
    filter?: { status?: ReminderStatus | undefined; taskId?: string | undefined; routineId?: string | undefined }
  ): Promise<any[]> {
    const where: any = {
      OR: [
        { task: { workspaceId } },
        { routine: { workspaceId } },
      ],
    };

    if (filter?.status) where.status = filter.status;
    if (filter?.taskId) where.taskId = filter.taskId;
    if (filter?.routineId) where.routineId = filter.routineId;

    const reminders = await prisma.reminder.findMany({
      where,
      include: {
        task: {
          select: { id: true, title: true, priority: true, status: true },
        },
        routine: {
          select: { id: true, title: true, frequency: true, isActive: true },
        },
      },
      orderBy: { remindAt: 'asc' },
    });

    return reminders.map((r) => ({
      ...r,
      remindAt: r.remindAt.toISOString(),
      deliveredAt: r.deliveredAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  /**
   * Creates a custom reminder.
   */
  async createReminder(
    workspaceId: string,
    data: {
      taskId?: string | null | undefined;
      routineId?: string | null | undefined;
      remindAt: Date;
      message?: string | undefined;
      type?: string | undefined;
    }
  ): Promise<Reminder> {
    if (!data.taskId && !data.routineId) {
      throw new Error('Either taskId or routineId must be provided');
    }

    if (data.taskId) {
      const task = await prisma.task.findFirst({
        where: { id: data.taskId, workspaceId },
      });
      if (!task) throw new Error('Task not found in active workspace');
    }

    if (data.routineId) {
      const routine = await prisma.routine.findFirst({
        where: { id: data.routineId, workspaceId },
      });
      if (!routine) throw new Error('Routine not found in active workspace');
    }

    return prisma.reminder.create({
      data: {
        taskId: data.taskId ?? null,
        routineId: data.routineId ?? null,
        remindAt: data.remindAt,
        message: data.message ?? null,
        type: data.type ?? 'custom',
        status: ReminderStatus.PENDING,
      },
    });
  }

  /**
   * Updates an existing reminder.
   */
  async updateReminder(
    workspaceId: string,
    reminderId: string,
    patch: { remindAt?: Date | undefined; message?: string | undefined; status?: ReminderStatus | undefined }
  ): Promise<Reminder | null> {
    const existing = await prisma.reminder.findFirst({
      where: {
        id: reminderId,
        OR: [
          { task: { workspaceId } },
          { routine: { workspaceId } },
        ],
      },
    });

    if (!existing) return null;

    const data: any = {};
    if (patch.remindAt) data.remindAt = patch.remindAt;
    if (patch.message !== undefined) data.message = patch.message;
    if (patch.status) data.status = patch.status;

    return prisma.reminder.update({
      where: { id: reminderId },
      data,
    });
  }

  /**
   * Cancels a pending reminder.
   */
  async cancelReminder(workspaceId: string, reminderId: string): Promise<boolean> {
    const existing = await prisma.reminder.findFirst({
      where: {
        id: reminderId,
        OR: [
          { task: { workspaceId } },
          { routine: { workspaceId } },
        ],
      },
    });

    if (!existing) return false;

    await prisma.reminder.update({
      where: { id: reminderId },
      data: { status: ReminderStatus.CANCELLED },
    });

    return true;
  }

  /**
   * Deletes a reminder permanently.
   */
  async deleteReminder(workspaceId: string, reminderId: string): Promise<boolean> {
    const existing = await prisma.reminder.findFirst({
      where: {
        id: reminderId,
        OR: [
          { task: { workspaceId } },
          { routine: { workspaceId } },
        ],
      },
    });

    if (!existing) return false;

    await prisma.reminder.delete({
      where: { id: reminderId },
    });

    return true;
  }

  /**
   * Automatically synchronizes default schedule and deadline reminders when a task changes.
   * Does not overwrite custom reminders.
   */
  async syncTaskDefaultReminders(workspaceId: string, task: any): Promise<void> {
    if (!task?.id) return;

    try {
      const taskExists = await prisma.task.findUnique({
        where: { id: task.id },
        select: { id: true },
      });
      if (!taskExists) return;

      const settings = await prisma.userSettings.findUnique({
        where: { workspaceId },
      });

      const autoSchedule = settings?.autoScheduleReminder ?? true;
      const autoDeadline = settings?.autoDeadlineReminder ?? true;
      const defaultScheduleTime = settings?.defaultScheduleReminderTime ?? '09:00';
      const defaultDaysBefore = settings?.defaultDeadlineReminderDaysBefore ?? 2;
      const defaultDeadlineTime = settings?.defaultDeadlineReminderTime ?? '09:00';

      const now = new Date();

      // 1. Sync schedule reminder
      if (task.scheduledStart && autoSchedule) {
        const scheduleDate = new Date(task.scheduledStart);
        const [h, m] = defaultScheduleTime.split(':').map(Number);
        const scheduleReminderAt = new Date(scheduleDate);
        scheduleReminderAt.setHours(h ?? 9, m ?? 0, 0, 0);

        if (scheduleReminderAt > now) {
          const existingScheduleRem = await prisma.reminder.findFirst({
            where: { taskId: task.id, type: 'pre_task' },
          });

          if (existingScheduleRem) {
            if (existingScheduleRem.status === ReminderStatus.PENDING) {
              await prisma.reminder.update({
                where: { id: existingScheduleRem.id },
                data: { remindAt: scheduleReminderAt },
              });
            }
          } else {
            await prisma.reminder.create({
              data: {
                taskId: task.id,
                type: 'pre_task',
                remindAt: scheduleReminderAt,
                message: `Schedule reminder: "${task.title}" is planned for today`,
                status: ReminderStatus.PENDING,
              },
            }).catch(() => {});
          }
        }
      }

      // 2. Sync deadline reminder
      if (task.deadline && autoDeadline) {
        const deadlineDate = new Date(task.deadline);
        const [dh, dm] = defaultDeadlineTime.split(':').map(Number);
        const deadlineReminderAt = new Date(deadlineDate);
        deadlineReminderAt.setDate(deadlineReminderAt.getDate() - defaultDaysBefore);
        deadlineReminderAt.setHours(dh ?? 9, dm ?? 0, 0, 0);

        if (deadlineReminderAt > now) {
          const existingDeadlineRem = await prisma.reminder.findFirst({
            where: { taskId: task.id, type: 'deadline' },
          });

          if (existingDeadlineRem) {
            if (existingDeadlineRem.status === ReminderStatus.PENDING) {
              await prisma.reminder.update({
                where: { id: existingDeadlineRem.id },
                data: { remindAt: deadlineReminderAt },
              });
            }
          } else {
            await prisma.reminder.create({
              data: {
                taskId: task.id,
                type: 'deadline',
                remindAt: deadlineReminderAt,
                message: `Deadline reminder: "${task.title}" is due in ${defaultDaysBefore} days`,
                status: ReminderStatus.PENDING,
              },
            }).catch(() => {});
          }
        }
      }
    } catch {
      // Gracefully handle concurrency
    }
  }

  /**
   * Cancels all pending reminders for a task when it is completed, archived, or deleted.
   */
  async cancelTaskReminders(taskId: string): Promise<void> {
    await prisma.reminder.updateMany({
      where: {
        taskId,
        status: ReminderStatus.PENDING,
      },
      data: {
        status: ReminderStatus.CANCELLED,
      },
    });
  }

  /**
   * Subscribes a browser client for Web Push notifications.
   */
  async subscribePush(
    workspaceId: string,
    endpoint: string,
    p256dh: string,
    auth: string
  ): Promise<void> {
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        workspaceId,
        p256dh,
        auth,
      },
      create: {
        workspaceId,
        endpoint,
        p256dh,
        auth,
      },
    });
  }

  /**
   * Unsubscribes a browser client.
   */
  async unsubscribePush(endpoint: string): Promise<void> {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint },
    });
  }
}

export const reminderService = new ReminderService();
