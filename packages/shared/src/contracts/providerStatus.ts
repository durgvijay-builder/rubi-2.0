import { z } from 'zod';

export const ProviderIdEnum = z.enum(['database', 'stt', 'gemini', 'tts']);
export type ProviderId = z.infer<typeof ProviderIdEnum>;

export const ProviderStatusCodeEnum = z.enum([
  'NOT_VERIFIED',
  'CONNECTED',
  'AUTHENTICATION_FAILED',
  'UNAVAILABLE',
  'OFFLINE_MOCK',
]);
export type ProviderStatusCode = z.infer<typeof ProviderStatusCodeEnum>;

export const ProviderErrorCategoryEnum = z.enum([
  'AUTH',
  'NETWORK',
  'RATE_LIMIT',
  'TIMEOUT',
  'SERVER_ERROR',
  'CONFIG',
]);
export type ProviderErrorCategory = z.infer<typeof ProviderErrorCategoryEnum>;

export const ProviderHealthDetailSchema = z.object({
  id: ProviderIdEnum,
  name: z.string(),
  status: ProviderStatusCodeEnum,
  isMock: z.boolean(),
  configuredModel: z.string().optional(),
  lastVerifiedAt: z.string().nullable().optional(),
  lastFailureAt: z.string().nullable().optional(),
  lastError: z.string().nullable().optional(),
  errorCategory: ProviderErrorCategoryEnum.nullable().optional(),
  details: z.string().optional(),
});
export type ProviderHealthDetail = z.infer<typeof ProviderHealthDetailSchema>;

export const SystemProvidersStatusSchema = z.object({
  database: ProviderHealthDetailSchema,
  stt: ProviderHealthDetailSchema,
  gemini: ProviderHealthDetailSchema,
  tts: ProviderHealthDetailSchema,
  mode: z.enum(['live', 'offline', 'auto']),
  overallStatus: z.enum(['healthy', 'degraded', 'offline']),
  timestamp: z.string(),
  uptime: z.number().optional(),
});
export type SystemProvidersStatus = z.infer<typeof SystemProvidersStatusSchema>;

