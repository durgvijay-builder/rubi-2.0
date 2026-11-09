import { z } from 'zod';

export const DEFAULT_CATEGORIES = [
  'College',
  'Self learning',
  'Side hustle',
  'Channel',
  'Ghar ka!',
] as const;

export const DEFAULT_SLOTS = [
  'Not decided',
  'After morning',
  'Morning',
  'Afternoon',
  'After College',
  'Before dinner',
  'After dinner',
  'Night',
] as const;

export const UserSettingsSchema = z.object({
  timezone: z.string().min(1).default('Asia/Kolkata'),
  defaultScheduleReminderTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('09:00'),
  defaultDeadlineReminderDaysBefore: z.number().int().min(0).max(30).default(2),
  defaultDeadlineReminderTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('09:00'),
  customSlots: z.array(z.string().min(1).max(50)).default([]),
  autoScheduleReminder: z.boolean().default(true),
  autoDeadlineReminder: z.boolean().default(true),
});

export type UserSettingsDTO = z.infer<typeof UserSettingsSchema>;

export const UpdateUserSettingsSchema = UserSettingsSchema.partial();
export type UpdateUserSettingsDTO = z.infer<typeof UpdateUserSettingsSchema>;

export const CategorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(50),
  color: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
});

export type CategoryDTO = z.infer<typeof CategorySchema>;

