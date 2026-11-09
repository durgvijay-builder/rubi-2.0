import { z } from 'zod';

export const DayOfWeek = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 7,
} as const;

export type DayOfWeekValue = (typeof DayOfWeek)[keyof typeof DayOfWeek];

export const DAY_NAMES: Record<number, { short: string; full: string }> = {
  1: { short: 'Mon', full: 'Monday' },
  2: { short: 'Tue', full: 'Tuesday' },
  3: { short: 'Wed', full: 'Wednesday' },
  4: { short: 'Thu', full: 'Thursday' },
  5: { short: 'Fri', full: 'Friday' },
  6: { short: 'Sat', full: 'Saturday' },
  7: { short: 'Sun', full: 'Sunday' },
};

export const RoutineFrequencySchema = z.enum(['DAILY', 'WEEKLY']);
export type RoutineFrequency = z.infer<typeof RoutineFrequencySchema>;

export const CreateRoutineSchema = z.object({
  title: z.string().min(1, 'Routine title is required').max(200),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  frequency: RoutineFrequencySchema.default('DAILY'),
  daysOfWeek: z.array(z.number().int().min(1).max(7)).default([1, 2, 3, 4, 5, 6, 7]),
  slot: z.string().optional().nullable(),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be HH:mm').optional().nullable(),
  isActive: z.boolean().default(true),
  targetPerWeek: z.number().int().min(1).max(7).optional().nullable(),
  reminderTime: z.string().optional().nullable(),
});

export type CreateRoutineDTO = z.infer<typeof CreateRoutineSchema>;

export const UpdateRoutineSchema = CreateRoutineSchema.partial();
export type UpdateRoutineDTO = z.infer<typeof UpdateRoutineSchema>;

export const RoutineOccurrenceSchema = z.object({
  routineId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  status: z.enum(['COMPLETED', 'SKIPPED']).default('COMPLETED'),
  notes: z.string().optional().nullable(),
});

export type RoutineOccurrenceDTO = z.infer<typeof RoutineOccurrenceSchema>;

export interface RoutineEntity {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  category: string | null;
  frequency: string;
  daysOfWeek: number[];
  slot: string | null;
  time: string | null;
  isActive: boolean;
  targetPerWeek: number | null;
  reminderTime: string | null;
  createdAt: string;
  updatedAt: string;
  occurrences?: RoutineOccurrenceEntity[];
  completedToday?: boolean;
}

export interface RoutineOccurrenceEntity {
  id: string;
  routineId: string;
  date: string;
  status: string;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
}

