import crypto from 'node:crypto';
import { prisma } from '../db.js';
import {
  TaskStatus,
  TaskPriority,
  EffortLevel,
  ActivityEventType,
  Prisma,
  type Task,
  type User,
  type TaskDependency,
  type Subtask,
  type Category,
  type UserSettings,
} from '@prisma/client';
import { detectCycle } from '@rubi/shared';
import { reminderService } from './reminderService.js';

export class CircularDependencyError extends Error {
  constructor(message = 'Cannot commit batch: circular dependency unresolved.') {
    super(message);
    this.name = 'CircularDependencyError';
  }
}

export class InvalidDependencyError extends Error {
  constructor(message = 'Referenced prerequisite task does not exist in workspace.') {
    super(message);
    this.name = 'InvalidDependencyError';
  }
}

export class InvalidStatusOrPriorityError extends Error {
  constructor(message = 'Invalid status or priority value') {
    super(message);
    this.name = 'InvalidStatusOrPriorityError';
  }
}

export const ALLOWED_TASK_STATUSES = new Set([
  'PENDING_APPROVAL',
  'TODO',
  'TO_DO',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
]);

export const ALLOWED_TASK_PRIORITIES = new Set([
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
]);

export const ALLOWED_EFFORT_LEVELS = new Set([
  'SMALL',
  'MEDIUM',
  'LARGE',
]);

export interface CandidateTaskPayload {
  tempId?: string | undefined;
  id?: string | undefined;
  title: string;
  description?: string | null | undefined;
  owner?: string | null | undefined;
  assignee?: string | null | undefined;
  priority?: TaskPriority | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | undefined;
  effort?: EffortLevel | 'SMALL' | 'MEDIUM' | 'LARGE' | undefined;
  slot?: string | undefined;
  categories?: string[] | undefined;
  schedule?: string | null | undefined;
  scheduledStart?: string | null | undefined;
  scheduledEnd?: string | null | undefined;
  deadline?: string | null | undefined;
  reminderTime?: string | null | undefined;
  subtasks?: Array<{ id?: string; title: string; isCompleted?: boolean; order?: number } | string> | undefined;
  dependencies?: string[] | undefined;
  status?: string | undefined;
  cycleError?: boolean | undefined;
}

export interface SerializedSubtask {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedTask {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  effort: string;
  slot: string;
  categories: string[];
  schedule: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  deadline: string | null;
  reminderTime: string | null;
  assignee: string | null;
  owner: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  dependencies: string[];
  subtasks: SerializedSubtask[];
}

export function toApiStatus(dbStatus: TaskStatus | string): string {
  if (dbStatus === 'TODO') return 'TO_DO';
  return dbStatus;
}

export function toDbStatus(apiStatus: string): TaskStatus {
  if (apiStatus === 'TO_DO') return TaskStatus.TODO;
  return apiStatus as TaskStatus;
}

export function formatTaskRecord(
  task: Task & {
    assignee?: User | null;
    dependencies?: TaskDependency[];
    subtasks?: Subtask[];
  }
): SerializedTask {
  const assigneeName = task.assignee?.name ?? null;
  const depIds = task.dependencies?.map((d) => d.dependsOnId) ?? [];
  const subtaskList: SerializedSubtask[] = (task.subtasks ?? [])
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      id: s.id,
      taskId: s.taskId,
      title: s.title,
      isCompleted: s.isCompleted,
      order: s.order,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));

  return {
    id: task.id,
    workspaceId: task.workspaceId,
    title: task.title,
    description: task.description,
    status: toApiStatus(task.status),
    priority: task.priority,
    effort: task.effort,
    slot: task.slot,
    categories: task.categories ?? [],
    schedule: task.scheduledStart ? task.scheduledStart.toISOString() : null,
    scheduledStart: task.scheduledStart ? task.scheduledStart.toISOString() : null,
    scheduledEnd: task.scheduledEnd ? task.scheduledEnd.toISOString() : null,
    deadline: task.deadline ? task.deadline.toISOString() : null,
    reminderTime: task.reminderTime ? task.reminderTime.toISOString() : null,
    assignee: assigneeName,
    owner: assigneeName,
    isArchived: task.isArchived,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    dependencies: depIds,
    subtasks: subtaskList,
  };
}

/**
 * Resolves an existing user in the workspace or returns null.
 * Strictly avoids auto-provisioning new user records for personal task management.
 */
export async function resolveOrCreateAssigneeId(
  workspaceId: string,
  assigneeName: string | null | undefined,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<string | null> {
  if (!assigneeName || !assigneeName.trim()) return null;
  const trimmed = assigneeName.trim();

  // If valid UUID, check if user exists in this workspace
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    const userById = await tx.user.findFirst({
      where: { id: trimmed, workspaceId },
    });
    if (userById) return userById.id;
  }

  // Find by existing user name
  const existingUser = await tx.user.findFirst({
    where: {
      workspaceId,
      name: { equals: trimmed, mode: 'insensitive' },
    },
  });
  if (existingUser) return existingUser.id;

  // Personal task workflow rule: Do not auto-provision user records
  return null;
}

/**
 * Compares tasks by nearest deadline first:
 * - Tasks with deadlines come before undated tasks.
 * - Earlier deadlines (including past/overdue deadlines) come before later ones.
 * - Secondary tie-breaker: Priority (CRITICAL > HIGH > MEDIUM > LOW).
 * - Tertiary tie-breaker: Scheduled start time (earlier first).
 * - Final tie-breaker: Created timestamp ascending.
 */
export function compareTasksByDeadline(
  a: Task & { assignee?: User | null; dependencies?: TaskDependency[]; subtasks?: Subtask[] },
  b: Task & { assignee?: User | null; dependencies?: TaskDependency[]; subtasks?: Subtask[] }
): number {
  const aDeadline = a.deadline ? a.deadline.getTime() : null;
  const bDeadline = b.deadline ? b.deadline.getTime() : null;

  if (aDeadline !== null && bDeadline !== null) {
    if (aDeadline !== bDeadline) {
      return aDeadline - bDeadline;
    }
  } else if (aDeadline !== null && bDeadline === null) {
    return -1;
  } else if (aDeadline === null && bDeadline !== null) {
    return 1;
  }

  // Priority sorting
  const priorityWeights: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };
  const weightA = priorityWeights[a.priority] ?? 2;
  const weightB = priorityWeights[b.priority] ?? 2;
  if (weightA !== weightB) {
    return weightB - weightA;
  }

  // Scheduled start sorting
  const aSched = a.scheduledStart ? a.scheduledStart.getTime() : null;
  const bSched = b.scheduledStart ? b.scheduledStart.getTime() : null;
  if (aSched !== null && bSched !== null) {
    if (aSched !== bSched) return aSched - bSched;
  } else if (aSched !== null && bSched === null) {
    return -1;
  } else if (aSched === null && bSched !== null) {
    return 1;
  }

  return a.createdAt.getTime() - b.createdAt.getTime();
}

export class TaskService {
  /**
   * Retrieves tasks scoped to workspace with deadline sorting and personal view/category filters.
   */
  async getTasks(
    workspaceId: string,
    filters?: {
      archived?: boolean | string | undefined;
      view?: string | undefined; // 'ALL' | 'TODAY' | 'UPCOMING' | 'OVERDUE' | 'COMPLETED' | 'ARCHIVED'
      category?: string | undefined;
      status?: string | undefined;
      priority?: string | undefined;
      effort?: string | undefined;
      assignee?: string | undefined;
      search?: string | undefined;
    }
  ): Promise<{ tasks: SerializedTask[]; total: number }> {
    const isArchivedFilter =
      filters?.view === 'ARCHIVED' ||
      filters?.archived === true ||
      filters?.archived === 'true';

    const where: Prisma.TaskWhereInput = {
      workspaceId,
      isArchived: isArchivedFilter,
    };

    if (filters?.status) {
      where.status = toDbStatus(filters.status);
    }

    if (filters?.priority && ALLOWED_TASK_PRIORITIES.has(filters.priority)) {
      where.priority = filters.priority as TaskPriority;
    }

    if (filters?.effort && ALLOWED_EFFORT_LEVELS.has(filters.effort)) {
      where.effort = filters.effort as EffortLevel;
    }

    if (filters?.category && filters.category.trim()) {
      where.categories = {
        has: filters.category.trim(),
      };
    }

    if (filters?.assignee) {
      where.assignee = {
        name: { contains: filters.assignee, mode: 'insensitive' },
      };
    }

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Retrieve workspace user settings for timezone-aware date calculations
    const userSettings = await prisma.userSettings.findUnique({
      where: { workspaceId },
    });
    const timezone = userSettings?.timezone || 'Asia/Kolkata';

    // Calculate start & end of today in user's timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const todayYmd = formatter.format(now); // e.g. "2026-11-08"

    // Construct UTC boundaries for today in user's timezone
    // Using a safe approximation for boundaries
    const startOfTodayUtc = new Date(`${todayYmd}T00:00:00.000Z`);
    // Adjust for timezone offset
    const endOfTodayUtc = new Date(`${todayYmd}T23:59:59.999Z`);

    const view = filters?.view?.toUpperCase();

    if (view === 'COMPLETED') {
      where.status = TaskStatus.COMPLETED;
    } else if (view === 'OVERDUE') {
      where.status = { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED, TaskStatus.ARCHIVED] };
      where.deadline = { lt: now };
    } else if (view === 'TODAY') {
      where.status = { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED, TaskStatus.ARCHIVED] };
      where.OR = [
        {
          deadline: {
            gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
            lte: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          },
        },
        {
          scheduledStart: {
            gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
            lte: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      ];
    } else if (view === 'UPCOMING') {
      where.status = { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED, TaskStatus.ARCHIVED] };
      where.OR = [
        { deadline: { gt: now } },
        { scheduledStart: { gt: now } },
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: true,
        dependencies: true,
        subtasks: {
          orderBy: { order: 'asc' },
        },
      },
    });

    // Sort by nearest deadline first
    tasks.sort(compareTasksByDeadline);

    return {
      tasks: tasks.map(formatTaskRecord),
      total: tasks.length,
    };
  }

  /**
   * Get task by ID within workspace.
   */
  async getTaskById(workspaceId: string, taskId: string): Promise<SerializedTask | null> {
    const task = await prisma.task.findFirst({
      where: { id: taskId, workspaceId },
      include: {
        assignee: true,
        dependencies: true,
        subtasks: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!task) return null;
    return formatTaskRecord(task);
  }

  /**
   * Batch commit candidate tasks from HITL review queue into PostgreSQL.
   * Runs Kahn's algorithm DAG cycle detection first and rejects circular batches with 422.
   * Seamlessly persists personal fields (effort, slot, categories, schedule, deadline, reminderTime, subtasks).
   */
  async batchCommitTasks(
    workspaceId: string,
    actorId: string | null,
    candidateTasks: CandidateTaskPayload[]
  ): Promise<SerializedTask[]> {
    if (!candidateTasks || candidateTasks.length === 0) {
      return [];
    }

    // 1. Commit-stage DAG cycle validation
    if (candidateTasks.some((t) => t.cycleError)) {
      throw new CircularDependencyError('Cannot commit batch: circular dependency unresolved.');
    }

    const cycleCheckNodes = candidateTasks.map((t, idx) => ({
      tempId: t.tempId || t.id || `temp-${idx}`,
      dependencies: t.dependencies || [],
    }));

    const cycleResult = detectCycle(cycleCheckNodes);
    if (cycleResult.hasCycle) {
      throw new CircularDependencyError('Cannot commit batch: circular dependency unresolved.');
    }

    // 2. Execute atomic transaction
    try {
      const committed = await prisma.$transaction(async (tx) => {
        const tempIdToRealIdMap = new Map<string, string>();

        // Generate UUIDs ahead of time
        for (let i = 0; i < candidateTasks.length; i++) {
          const item = candidateTasks[i]!;
          const realId = crypto.randomUUID();
          if (item.tempId) tempIdToRealIdMap.set(item.tempId, realId);
          if (item.id) tempIdToRealIdMap.set(item.id, realId);
          tempIdToRealIdMap.set(`temp-${i}`, realId);
        }

        const batchRealIds = new Set(tempIdToRealIdMap.values());

        // Validate that non-batch referenced prerequisite tasks exist in workspace
        const externalDependencies = new Set<string>();
        for (let i = 0; i < candidateTasks.length; i++) {
          const item = candidateTasks[i]!;
          for (const depId of item.dependencies || []) {
            const resolvedDepId = tempIdToRealIdMap.get(depId) || depId;
            if (!batchRealIds.has(resolvedDepId)) {
              externalDependencies.add(resolvedDepId);
            }
          }
        }

        if (externalDependencies.size > 0) {
          const externalDepList = Array.from(externalDependencies);
          const existingTasks = await tx.task.findMany({
            where: {
              workspaceId,
              id: { in: externalDepList },
            },
            select: { id: true },
          });

          const foundIds = new Set(existingTasks.map((t) => t.id));
          for (const depId of externalDepList) {
            if (!foundIds.has(depId)) {
              throw new InvalidDependencyError(
                `Referenced prerequisite task "${depId}" does not exist in workspace.`
              );
            }
          }
        }

        const createdList: Array<
          Task & { assignee?: User | null; dependencies: TaskDependency[]; subtasks: Subtask[] }
        > = [];

        for (let i = 0; i < candidateTasks.length; i++) {
          const item = candidateTasks[i]!;
          const key = item.tempId || item.id || `temp-${i}`;
          const realId = tempIdToRealIdMap.get(key)!;

          // Resolve dependencies to real IDs
          const realDeps = (item.dependencies || []).map((depTempId) => {
            return tempIdToRealIdMap.get(depTempId) || depTempId;
          });

          // Determine initial status
          let initialStatus: TaskStatus = TaskStatus.TODO;
          if (realDeps.length > 0) {
            initialStatus = TaskStatus.BLOCKED;
          } else if (item.status) {
            initialStatus = toDbStatus(item.status);
          }

          const assigneeName = item.owner || item.assignee || null;
          const assigneeId = await resolveOrCreateAssigneeId(workspaceId, assigneeName, tx);

          let parsedDeadline: Date | null = null;
          if (item.deadline) {
            const d = new Date(item.deadline);
            if (!isNaN(d.getTime())) parsedDeadline = d;
          }

          let parsedScheduleStart: Date | null = null;
          const schedRaw = item.scheduledStart || item.schedule;
          if (schedRaw) {
            const s = new Date(schedRaw);
            if (!isNaN(s.getTime())) parsedScheduleStart = s;
          }

          let parsedScheduleEnd: Date | null = null;
          if (item.scheduledEnd) {
            const se = new Date(item.scheduledEnd);
            if (!isNaN(se.getTime())) parsedScheduleEnd = se;
          }

          let parsedReminderTime: Date | null = null;
          if (item.reminderTime) {
            const r = new Date(item.reminderTime);
            if (!isNaN(r.getTime())) parsedReminderTime = r;
          }

          const effort =
            item.effort && ALLOWED_EFFORT_LEVELS.has(item.effort)
              ? (item.effort as EffortLevel)
              : EffortLevel.MEDIUM;

          const slot = item.slot && item.slot.trim() ? item.slot.trim() : 'Not decided';
          const categories = Array.isArray(item.categories)
            ? item.categories.filter((c) => typeof c === 'string' && c.trim()).map((c) => c.trim())
            : [];

          const task = await tx.task.create({
            data: {
              id: realId,
              workspaceId,
              creatorId: actorId,
              assigneeId,
              title: item.title,
              description: item.description ?? null,
              status: initialStatus,
              priority: (item.priority as TaskPriority) || TaskPriority.MEDIUM,
              effort,
              slot,
              categories,
              deadline: parsedDeadline,
              scheduledStart: parsedScheduleStart,
              scheduledEnd: parsedScheduleEnd,
              reminderTime: parsedReminderTime,
              isArchived: false,
            },
          });

          // Persist Subtasks if provided
          const subtaskRecords: Subtask[] = [];
          if (item.subtasks && Array.isArray(item.subtasks)) {
            for (let sIdx = 0; sIdx < item.subtasks.length; sIdx++) {
              const st = item.subtasks[sIdx]!;
              const stTitle = typeof st === 'string' ? st : st.title;
              const isCompleted = typeof st === 'object' && Boolean(st.isCompleted);
              const order =
                typeof st === 'object' && typeof st.order === 'number' ? st.order : sIdx;

              if (stTitle && stTitle.trim()) {
                const createdSubtask = await tx.subtask.create({
                  data: {
                    taskId: realId,
                    title: stTitle.trim(),
                    isCompleted,
                    order,
                  },
                });
                subtaskRecords.push(createdSubtask);
              }
            }
          }

          // Persist Reminder record if reminderTime is provided
          if (parsedReminderTime) {
            await tx.reminder.create({
              data: {
                taskId: realId,
                remindAt: parsedReminderTime,
                type: 'custom',
                status: 'PENDING',
                message: `Reminder: ${task.title}`,
              },
            });
          }

          // Create TaskDependency records
          const depRecords: TaskDependency[] = [];
          for (const depId of realDeps) {
            const depRecord = await tx.taskDependency.create({
              data: {
                taskId: realId,
                dependsOnId: depId,
              },
            });
            depRecords.push(depRecord);
          }

          // Log Activity Events
          // 1. TASK_CREATED
          await tx.activityEvent.create({
            data: {
              workspaceId,
              taskId: realId,
              actorId,
              eventType: ActivityEventType.TASK_CREATED,
              description: `Task "${task.title}" created.`,
              metadata: {
                newState: {
                  title: task.title,
                  status: toApiStatus(task.status),
                  effort: task.effort,
                  slot: task.slot,
                  categories: task.categories,
                },
              },
            },
          });

          // 2. TASK_APPROVED
          await tx.activityEvent.create({
            data: {
              workspaceId,
              taskId: realId,
              actorId,
              eventType: ActivityEventType.TASK_APPROVED,
              description: `Task "${task.title}" approved by personal user.`,
              metadata: {
                previousState: { status: 'PENDING_APPROVAL' },
                newState: { status: toApiStatus(task.status) },
              },
            },
          });

          // 3. DEPENDENCY_ADDED if dependencies present
          if (realDeps.length > 0) {
            await tx.activityEvent.create({
              data: {
                workspaceId,
                taskId: realId,
                actorId,
                eventType: ActivityEventType.DEPENDENCY_ADDED,
                description: `Task "${task.title}" blocked by prerequisites.`,
                metadata: {
                  blockedBy: realDeps,
                },
              },
            });
          }

          const assigneeUser = assigneeId
            ? await tx.user.findUnique({ where: { id: assigneeId } })
            : null;

          createdList.push({
            ...task,
            assignee: assigneeUser,
            dependencies: depRecords,
            subtasks: subtaskRecords,
          });
        }

        return createdList.map(formatTaskRecord);
      });

      // Synchronize default reminders asynchronously
      for (const t of committed) {
        reminderService.syncTaskDefaultReminders(workspaceId, t).catch((err) => {
          console.warn('[TaskService] Error syncing default reminders:', err.message);
        });
      }

      return committed;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new InvalidDependencyError(
          'Referenced prerequisite task does not exist in workspace.'
        );
      }
      throw error;
    }
  }

  /**
   * Creates a single task or processes direct batch.
   */
  async createSingleTask(
    workspaceId: string,
    actorId: string | null,
    payload: CandidateTaskPayload
  ): Promise<SerializedTask> {
    const results = await this.batchCommitTasks(workspaceId, actorId, [payload]);
    const first = results[0];
    if (!first) {
      throw new Error('Failed to create task');
    }
    return first;
  }

  /**
   * Updates a task with unblocking cascade and personal field persistence.
   */
  async updateTask(
    workspaceId: string,
    taskId: string,
    patchData: {
      status?: string;
      title?: string;
      description?: string | null;
      assignee?: string | null;
      owner?: string | null;
      priority?: string;
      effort?: string;
      slot?: string;
      categories?: string[];
      schedule?: string | null;
      scheduledStart?: string | null;
      scheduledEnd?: string | null;
      deadline?: string | null;
      reminderTime?: string | null;
      subtasks?: Array<{ id?: string; title: string; isCompleted?: boolean; order?: number }>;
      isArchived?: boolean;
    },
    actorId?: string | null
  ): Promise<SerializedTask> {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.task.findFirst({
        where: { id: taskId, workspaceId },
        include: {
          assignee: true,
          dependencies: true,
          subtasks: { orderBy: { order: 'asc' } },
        },
      });

      if (!existing) {
        throw new Error(`Task ${taskId} not found in workspace`);
      }

      if (patchData.status !== undefined && !ALLOWED_TASK_STATUSES.has(patchData.status)) {
        throw new InvalidStatusOrPriorityError('Invalid status or priority value');
      }

      if (patchData.priority !== undefined && !ALLOWED_TASK_PRIORITIES.has(patchData.priority)) {
        throw new InvalidStatusOrPriorityError('Invalid status or priority value');
      }

      if (patchData.effort !== undefined && !ALLOWED_EFFORT_LEVELS.has(patchData.effort)) {
        throw new InvalidStatusOrPriorityError('Invalid status or priority value');
      }

      const prevApiStatus = toApiStatus(existing.status);
      const updatePayload: Prisma.TaskUpdateInput = {};

      if (patchData.status !== undefined) {
        updatePayload.status = toDbStatus(patchData.status);
      }
      if (patchData.title !== undefined) {
        updatePayload.title = patchData.title;
      }
      if (patchData.description !== undefined) {
        updatePayload.description = patchData.description;
      }
      if (patchData.priority !== undefined) {
        updatePayload.priority = patchData.priority as TaskPriority;
      }
      if (patchData.effort !== undefined) {
        updatePayload.effort = patchData.effort as EffortLevel;
      }
      if (patchData.slot !== undefined) {
        updatePayload.slot = patchData.slot;
      }
      if (patchData.categories !== undefined) {
        updatePayload.categories = patchData.categories;
      }
      if (patchData.deadline !== undefined) {
        updatePayload.deadline = patchData.deadline ? new Date(patchData.deadline) : null;
      }
      const schedVal = patchData.scheduledStart !== undefined ? patchData.scheduledStart : patchData.schedule;
      if (schedVal !== undefined) {
        updatePayload.scheduledStart = schedVal ? new Date(schedVal) : null;
      }
      if (patchData.scheduledEnd !== undefined) {
        updatePayload.scheduledEnd = patchData.scheduledEnd ? new Date(patchData.scheduledEnd) : null;
      }
      if (patchData.reminderTime !== undefined) {
        const parsedReminder = patchData.reminderTime ? new Date(patchData.reminderTime) : null;
        updatePayload.reminderTime = parsedReminder;

        if (parsedReminder) {
          // Upsert or create reminder
          const existingReminder = await tx.reminder.findFirst({
            where: { taskId },
          });
          if (existingReminder) {
            await tx.reminder.update({
              where: { id: existingReminder.id },
              data: {
                remindAt: parsedReminder,
                status: 'PENDING',
                deliveredAt: null,
              },
            });
          } else {
            await tx.reminder.create({
              data: {
                taskId,
                remindAt: parsedReminder,
                type: 'custom',
                status: 'PENDING',
                message: `Reminder: ${patchData.title ?? existing.title}`,
              },
            });
          }
        }
      }
      if (patchData.isArchived !== undefined) {
        updatePayload.isArchived = patchData.isArchived;
        updatePayload.archivedAt = patchData.isArchived ? new Date() : null;
        if (patchData.isArchived) {
          updatePayload.status = TaskStatus.ARCHIVED;
        } else if (existing.status === TaskStatus.ARCHIVED) {
          updatePayload.status = TaskStatus.TODO;
        }
      }

      const assigneeName = patchData.assignee !== undefined ? patchData.assignee : patchData.owner;
      if (assigneeName !== undefined) {
        const newAssigneeId = await resolveOrCreateAssigneeId(workspaceId, assigneeName, tx);
        updatePayload.assignee = newAssigneeId
          ? { connect: { id: newAssigneeId } }
          : { disconnect: true };
      }

      // Sync subtasks if provided in update payload
      if (patchData.subtasks && Array.isArray(patchData.subtasks)) {
        // Remove existing subtasks not in incoming list, update existing, add new
        const incomingIds = new Set(patchData.subtasks.map((s) => s.id).filter(Boolean));
        await tx.subtask.deleteMany({
          where: {
            taskId,
            id: { notIn: Array.from(incomingIds as Set<string>) },
          },
        });

        for (let idx = 0; idx < patchData.subtasks.length; idx++) {
          const item = patchData.subtasks[idx]!;
          if (item.id) {
            await tx.subtask.update({
              where: { id: item.id },
              data: {
                title: item.title,
                isCompleted: Boolean(item.isCompleted),
                order: typeof item.order === 'number' ? item.order : idx,
              },
            });
          } else {
            await tx.subtask.create({
              data: {
                taskId,
                title: item.title,
                isCompleted: Boolean(item.isCompleted),
                order: typeof item.order === 'number' ? item.order : idx,
              },
            });
          }
        }
      }

      const updated = await tx.task.update({
        where: { id: taskId },
        data: updatePayload,
        include: {
          assignee: true,
          dependencies: true,
          subtasks: { orderBy: { order: 'asc' } },
        },
      });

      // ── Status Change Handling & Unblocking Cascade ──────────────────────────
      if (patchData.status !== undefined && patchData.status !== prevApiStatus) {
        const newApiStatus = toApiStatus(updated.status);

        await tx.activityEvent.create({
          data: {
            workspaceId,
            taskId,
            actorId: actorId ?? null,
            eventType: ActivityEventType.TASK_STATUS_CHANGED,
            description: `Task status changed from ${prevApiStatus} to ${newApiStatus}`,
            metadata: {
              previousState: { status: prevApiStatus },
              newState: { status: newApiStatus },
            },
          },
        });

        // If marked COMPLETED, cascade to unblock dependent tasks
        if (updated.status === TaskStatus.COMPLETED) {
          const dependentJoins = await tx.taskDependency.findMany({
            where: { dependsOnId: taskId },
            include: {
              task: {
                include: {
                  dependencies: {
                    include: { dependsOn: true },
                  },
                },
              },
            },
          });

          for (const join of dependentJoins) {
            const dependentTask = join.task;
            if (
              dependentTask.workspaceId === workspaceId &&
              dependentTask.status === TaskStatus.BLOCKED
            ) {
              const allMet = dependentTask.dependencies.every(
                (d) => d.dependsOnId === taskId || d.dependsOn.status === TaskStatus.COMPLETED
              );

              if (allMet) {
                const prevDepStatus = toApiStatus(dependentTask.status);
                await tx.task.update({
                  where: { id: dependentTask.id },
                  data: { status: TaskStatus.TODO },
                });

                await tx.activityEvent.create({
                  data: {
                    workspaceId,
                    taskId: dependentTask.id,
                    actorId: actorId ?? null,
                    eventType: ActivityEventType.TASK_STATUS_CHANGED,
                    description: `Task "${dependentTask.title}" unblocked because all prerequisites completed.`,
                    metadata: {
                      previousState: { status: prevDepStatus },
                      newState: { status: 'TO_DO' },
                      reason: `Prerequisite ${taskId} completed`,
                    },
                  },
                });
              }
            }
          }
        }
      }

      // ── Archival Logging ─────────────────────────────────────────────────────
      if (patchData.isArchived !== undefined && patchData.isArchived !== existing.isArchived) {
        const eventType = patchData.isArchived
          ? ActivityEventType.TASK_ARCHIVED
          : ActivityEventType.TASK_RESTORED;

        await tx.activityEvent.create({
          data: {
            workspaceId,
            taskId,
            actorId: actorId ?? null,
            eventType,
            description: patchData.isArchived
              ? `Task "${updated.title}" archived.`
              : `Task "${updated.title}" restored.`,
            metadata: {
              previousState: { isArchived: existing.isArchived },
              newState: { isArchived: updated.isArchived },
            },
          },
        });
      }

      // ── Field Updates Logging ────────────────────────────────────────────────
      await tx.activityEvent.create({
        data: {
          workspaceId,
          taskId,
          actorId: actorId ?? null,
          eventType: ActivityEventType.TASK_EDITED,
          description: `Task "${updated.title}" updated.`,
          metadata: {
            newState: {
              title: updated.title,
              priority: updated.priority,
              effort: updated.effort,
              slot: updated.slot,
              categories: updated.categories,
              deadline: updated.deadline ? updated.deadline.toISOString() : null,
              scheduledStart: updated.scheduledStart ? updated.scheduledStart.toISOString() : null,
            },
          },
        },
      });

      return formatTaskRecord(updated);
    });

    if (result.status === 'COMPLETED' || result.isArchived) {
      reminderService.cancelTaskReminders(taskId).catch(() => {});
    } else if (patchData.scheduledStart !== undefined || patchData.deadline !== undefined) {
      reminderService.syncTaskDefaultReminders(workspaceId, result).catch(() => {});
    }

    return result;
  }

  /**
   * Soft-archives a task.
   */
  async archiveTask(workspaceId: string, taskId: string, actorId?: string | null): Promise<SerializedTask> {
    return this.updateTask(workspaceId, taskId, { isArchived: true }, actorId);
  }

  /**
   * Restores an archived task back to active.
   */
  async restoreTask(workspaceId: string, taskId: string, actorId?: string | null): Promise<SerializedTask> {
    return this.updateTask(workspaceId, taskId, { isArchived: false, status: 'TO_DO' }, actorId);
  }

  /**
   * Queries dependency graph for task.
   */
  async getTaskDependencies(workspaceId: string, taskId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, workspaceId },
      include: {
        dependencies: {
          include: { dependsOn: true },
        },
        dependents: {
          include: { task: true },
        },
      },
    });

    if (!task) return null;

    const prerequisites = task.dependencies.map((d) => ({
      id: d.dependsOn.id,
      title: d.dependsOn.title,
      status: toApiStatus(d.dependsOn.status),
      priority: d.dependsOn.priority,
    }));

    const dependents = task.dependents.map((d) => ({
      id: d.task.id,
      title: d.task.title,
      status: toApiStatus(d.task.status),
      priority: d.task.priority,
    }));

    const isBlocked = prerequisites.some((p) => p.status !== 'COMPLETED');

    return {
      taskId: task.id,
      prerequisites,
      blockingDependencies: prerequisites,
      dependents,
      isBlocked,
    };
  }

  /**
   * Deletes task permanently with atomic audit snapshot, or soft-archives it.
   */
  async deleteTask(
    workspaceId: string,
    taskId: string,
    permanent = false,
    actorId?: string | null
  ): Promise<boolean> {
    if (!permanent) {
      await this.archiveTask(workspaceId, taskId, actorId);
      return true;
    }

    return await prisma.$transaction(async (tx) => {
      const existing = await tx.task.findFirst({
        where: { id: taskId, workspaceId },
        include: {
          subtasks: true,
          reminders: true,
          dependencies: true,
          dependents: true,
        },
      });

      if (!existing) return false;

      // Log TASK_DELETED activity snapshot before deleting record
      await tx.activityEvent.create({
        data: {
          workspaceId,
          taskId: null,
          actorId: actorId ?? null,
          eventType: ActivityEventType.TASK_DELETED,
          description: `Task "${existing.title}" permanently deleted.`,
          metadata: {
            deletedTaskId: existing.id,
            snapshot: {
              title: existing.title,
              description: existing.description,
              status: toApiStatus(existing.status),
              priority: existing.priority,
              effort: existing.effort,
              slot: existing.slot,
              categories: existing.categories,
              deadline: existing.deadline ? existing.deadline.toISOString() : null,
              scheduledStart: existing.scheduledStart ? existing.scheduledStart.toISOString() : null,
              reminderTime: existing.reminderTime ? existing.reminderTime.toISOString() : null,
              subtasks: existing.subtasks.map((s) => ({ title: s.title, isCompleted: s.isCompleted })),
            },
          },
        },
      });

      // Cascading cleanups: dependencies, reminders, subtasks
      await tx.taskDependency.deleteMany({
        where: {
          OR: [{ taskId }, { dependsOnId: taskId }],
        },
      });
      await tx.reminder.deleteMany({ where: { taskId } });
      await tx.subtask.deleteMany({ where: { taskId } });

      // Delete task record
      await tx.task.delete({ where: { id: taskId } });

      return true;
    });
  }

  // ── Subtask Operations ─────────────────────────────────────────────────────

  async addSubtask(
    workspaceId: string,
    taskId: string,
    title: string,
    order?: number
  ): Promise<SerializedSubtask> {
    const task = await prisma.task.findFirst({ where: { id: taskId, workspaceId } });
    if (!task) throw new Error(`Task ${taskId} not found`);

    const count = await prisma.subtask.count({ where: { taskId } });
    const subtask = await prisma.subtask.create({
      data: {
        taskId,
        title: title.trim(),
        order: typeof order === 'number' ? order : count,
      },
    });

    return {
      id: subtask.id,
      taskId: subtask.taskId,
      title: subtask.title,
      isCompleted: subtask.isCompleted,
      order: subtask.order,
      createdAt: subtask.createdAt.toISOString(),
      updatedAt: subtask.updatedAt.toISOString(),
    };
  }

  async updateSubtask(
    workspaceId: string,
    taskId: string,
    subtaskId: string,
    patch: { title?: string; isCompleted?: boolean; order?: number }
  ): Promise<SerializedSubtask> {
    const task = await prisma.task.findFirst({ where: { id: taskId, workspaceId } });
    if (!task) throw new Error(`Task ${taskId} not found`);

    const subtask = await prisma.subtask.findFirst({ where: { id: subtaskId, taskId } });
    if (!subtask) throw new Error(`Subtask ${subtaskId} not found`);

    const updated = await prisma.subtask.update({
      where: { id: subtaskId },
      data: {
        ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
        ...(patch.isCompleted !== undefined ? { isCompleted: patch.isCompleted } : {}),
        ...(patch.order !== undefined ? { order: patch.order } : {}),
      },
    });

    return {
      id: updated.id,
      taskId: updated.taskId,
      title: updated.title,
      isCompleted: updated.isCompleted,
      order: updated.order,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteSubtask(workspaceId: string, taskId: string, subtaskId: string): Promise<boolean> {
    const task = await prisma.task.findFirst({ where: { id: taskId, workspaceId } });
    if (!task) throw new Error(`Task ${taskId} not found`);

    const subtask = await prisma.subtask.findFirst({ where: { id: subtaskId, taskId } });
    if (!subtask) return false;

    await prisma.subtask.delete({ where: { id: subtaskId } });
    return true;
  }

  // ── Category Operations ────────────────────────────────────────────────────

  async getCategories(workspaceId: string): Promise<Category[]> {
    return prisma.category.findMany({
      where: { workspaceId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async createCategory(
    workspaceId: string,
    name: string,
    color?: string
  ): Promise<Category> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Category name is required');

    return prisma.category.upsert({
      where: {
        workspaceId_name: {
          workspaceId,
          name: trimmed,
        },
      },
      update: {
        ...(color ? { color } : {}),
      },
      create: {
        workspaceId,
        name: trimmed,
        color: color || '#71717a',
        isDefault: false,
      },
    });
  }

  async updateCategory(
    workspaceId: string,
    categoryId: string,
    patch: { name?: string; color?: string }
  ): Promise<Category | null> {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, workspaceId },
    });
    if (!category) return null;

    const data: any = {};
    if (patch.name?.trim()) data.name = patch.name.trim();
    if (patch.color) data.color = patch.color;

    return prisma.category.update({
      where: { id: categoryId },
      data,
    });
  }

  async deleteCategory(workspaceId: string, categoryId: string): Promise<boolean> {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, workspaceId },
    });
    if (!category) return false;
    await prisma.category.delete({ where: { id: categoryId } });
    return true;
  }

  // ── User Settings & Customization Operations ───────────────────────────────

  async getUserSettings(workspaceId: string): Promise<UserSettings> {
    let settings = await prisma.userSettings.findUnique({
      where: { workspaceId },
    });
    if (!settings) {
      settings = await prisma.userSettings.create({
        data: {
          workspaceId,
          timezone: 'Asia/Kolkata',
          defaultScheduleReminderTime: '09:00',
          defaultDeadlineReminderDaysBefore: 2,
          defaultDeadlineReminderTime: '09:00',
          customSlots: [],
          autoScheduleReminder: true,
          autoDeadlineReminder: true,
        },
      });
    }
    return settings;
  }

  async updateUserSettings(
    workspaceId: string,
    patch: {
      timezone?: string;
      defaultScheduleReminderTime?: string;
      defaultDeadlineReminderDaysBefore?: number;
      defaultDeadlineReminderTime?: string;
      customSlots?: string[];
      autoScheduleReminder?: boolean;
      autoDeadlineReminder?: boolean;
    }
  ): Promise<UserSettings> {
    const data: any = {};
    if (patch.timezone) data.timezone = patch.timezone;
    if (patch.defaultScheduleReminderTime) data.defaultScheduleReminderTime = patch.defaultScheduleReminderTime;
    if (patch.defaultDeadlineReminderDaysBefore !== undefined) data.defaultDeadlineReminderDaysBefore = patch.defaultDeadlineReminderDaysBefore;
    if (patch.defaultDeadlineReminderTime) data.defaultDeadlineReminderTime = patch.defaultDeadlineReminderTime;
    if (patch.customSlots) data.customSlots = patch.customSlots;
    if (patch.autoScheduleReminder !== undefined) data.autoScheduleReminder = patch.autoScheduleReminder;
    if (patch.autoDeadlineReminder !== undefined) data.autoDeadlineReminder = patch.autoDeadlineReminder;

    return prisma.userSettings.upsert({
      where: { workspaceId },
      update: data,
      create: {
        workspaceId,
        timezone: patch.timezone || 'Asia/Kolkata',
        defaultScheduleReminderTime: patch.defaultScheduleReminderTime || '09:00',
        defaultDeadlineReminderDaysBefore: patch.defaultDeadlineReminderDaysBefore ?? 2,
        defaultDeadlineReminderTime: patch.defaultDeadlineReminderTime || '09:00',
        customSlots: patch.customSlots || [],
        autoScheduleReminder: patch.autoScheduleReminder ?? true,
        autoDeadlineReminder: patch.autoDeadlineReminder ?? true,
      },
    });
  }
}

export const taskService = new TaskService();
