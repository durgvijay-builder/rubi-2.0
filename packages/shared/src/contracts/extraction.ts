import { z } from 'zod';

export const TaskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type TaskPriority = z.infer<typeof TaskPriorityEnum>;

export const EffortLevelEnum = z.enum(['SMALL', 'MEDIUM', 'LARGE']);
export type EffortLevel = z.infer<typeof EffortLevelEnum>;

export const TaskStatusEnum = z.enum([
  'PENDING_APPROVAL',
  'TODO',
  'TO_DO',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
]);
export type TaskStatus = z.infer<typeof TaskStatusEnum>;

export const ExtractedSubtaskSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  isCompleted: z.boolean().default(false),
  order: z.number().default(0),
});
export type ExtractedSubtask = z.infer<typeof ExtractedSubtaskSchema>;

/**
 * Normalized action item schema.
 * Preprocesses aliases:
 * - assignee -> owner
 * - targetDate -> deadline
 * - TO_DO -> TODO
 * - schedule -> scheduledStart
 */
export const ExtractedActionItemSchema = z.preprocess(
  (raw: unknown) => {
    if (raw && typeof raw === 'object') {
      const obj = { ...(raw as Record<string, unknown>) };
      if (obj.owner === undefined && obj.assignee !== undefined) {
        obj.owner = obj.assignee;
      }
      if (obj.assignee === undefined && obj.owner !== undefined) {
        obj.assignee = obj.owner;
      }
      if (obj.deadline === undefined && obj.targetDate !== undefined) {
        obj.deadline = obj.targetDate;
      }
      if (obj.targetDate === undefined && obj.deadline !== undefined) {
        obj.targetDate = obj.deadline;
      }
      if (obj.status === 'TO_DO') {
        obj.status = 'TODO';
      }
      if (obj.schedule && !obj.scheduledStart) {
        obj.scheduledStart = obj.schedule;
      }
      if (obj.scheduledStart && !obj.schedule) {
        obj.schedule = obj.scheduledStart;
      }
      if (typeof obj.subtasks === 'string') {
        obj.subtasks = [{ title: obj.subtasks, isCompleted: false, order: 0 }];
      } else if (Array.isArray(obj.subtasks)) {
        obj.subtasks = obj.subtasks.map((st, idx) => {
          if (typeof st === 'string') {
            return { title: st, isCompleted: false, order: idx };
          }
          return { ...st, order: st.order ?? idx };
        });
      }
      return obj;
    }
    return raw;
  },
  z.object({
    tempId: z.string(),
    title: z.string().min(1),
    description: z.string().optional(),
    owner: z.string().nullable().default(null),
    assignee: z.string().nullable().optional(),
    priority: TaskPriorityEnum.default('MEDIUM'),
    effort: EffortLevelEnum.default('MEDIUM').optional(),
    slot: z.string().default('Not decided').optional(),
    categories: z.array(z.string()).default([]).optional(),
    schedule: z.string().nullable().default(null).optional(),
    scheduledStart: z.string().nullable().default(null).optional(),
    scheduledEnd: z.string().nullable().default(null).optional(),
    deadline: z.string().nullable().default(null),
    targetDate: z.string().nullable().optional(),
    reminderTime: z.string().nullable().default(null).optional(),
    subtasks: z.array(ExtractedSubtaskSchema).default([]).optional(),
    dependencies: z.array(z.string()).default([]), // tempIds of blocking tasks
    status: TaskStatusEnum.default('PENDING_APPROVAL'),
    ambiguities: z.array(z.string()).default([]),
    cycleError: z.boolean().optional(),
    isRoutine: z.boolean().default(false).optional(),
    recurrencePattern: z.enum(['DAILY', 'WEEKDAYS', 'WEEKENDS', 'WEEKLY', 'CUSTOM']).optional(),
    reminderOffsetMinutes: z.number().optional(),
  })
);

export const ExtractedActionBatchSchema = z.object({
  summary: z.string(),
  tasks: z.array(ExtractedActionItemSchema),
  ambiguities: z.array(z.string()).default([]),
  hasCycle: z.boolean().optional(),
  cycleNodes: z.array(z.string()).optional(),
  cycleError: z.string().optional(),
  tokensUsed: z
    .object({
      promptTokens: z.number().default(0),
      completionTokens: z.number().default(0),
      totalTokens: z.number().default(0),
      estimatedCostUsd: z.number().default(0),
    })
    .default({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
    }),
});

export type ExtractedActionItem = z.infer<typeof ExtractedActionItemSchema>;
export type ExtractedActionBatch = z.infer<typeof ExtractedActionBatchSchema>;

export interface IExtractionAdapter {
  extractActions(transcript: string, context?: Record<string, unknown>): Promise<ExtractedActionBatch>;
}
