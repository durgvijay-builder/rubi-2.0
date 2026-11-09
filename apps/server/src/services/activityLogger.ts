import { prisma } from '../db.js';
import { ActivityEventType, Prisma } from '@prisma/client';

export interface LogActivityParams {
  workspaceId: string;
  eventType: ActivityEventType;
  taskId?: string | null;
  actorId?: string | null;
  description: string;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface QueryActivitiesOptions {
  taskId?: string | undefined;
  eventType?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface SerializedActivityEvent {
  id: string;
  workspaceId: string;
  taskId: string | null;
  actorId: string | null;
  actorType: 'USER' | 'SYSTEM' | 'AI';
  eventType: string;
  description: string;
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export function formatActivityEvent(event: {
  id: string;
  workspaceId: string;
  taskId: string | null;
  actorId: string | null;
  eventType: ActivityEventType | string;
  description: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
}): SerializedActivityEvent {
  const meta = (event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata))
    ? (event.metadata as Record<string, unknown>)
    : null;

  const previousState = (meta?.previousState as Record<string, unknown>) || null;
  const newState = (meta?.newState as Record<string, unknown>) || null;

  return {
    id: event.id,
    workspaceId: event.workspaceId,
    taskId: event.taskId,
    actorId: event.actorId,
    actorType: 'USER',
    eventType: event.eventType,
    description: event.description,
    previousState,
    newState,
    metadata: meta,
    createdAt: event.createdAt.toISOString(),
  };
}

export class ActivityLoggerService {
  /**
   * Records an immutable activity event into PostgreSQL.
   */
  async logActivity(params: LogActivityParams): Promise<SerializedActivityEvent> {
    const metaPayload: Record<string, unknown> = {
      ...(params.metadata || {}),
    };

    if (params.previousState) {
      metaPayload.previousState = params.previousState;
    }
    if (params.newState) {
      metaPayload.newState = params.newState;
    }

    const event = await prisma.activityEvent.create({
      data: {
        workspaceId: params.workspaceId,
        taskId: params.taskId ?? null,
        actorId: params.actorId ?? null,
        eventType: params.eventType,
        description: params.description,
        metadata: Object.keys(metaPayload).length > 0 ? (metaPayload as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });

    return formatActivityEvent(event);
  }

  /**
   * Queries activity events chronologically (latest first) scoped to workspace.
   */
  async getActivities(
    workspaceId: string,
    options?: QueryActivitiesOptions
  ): Promise<{ activities: SerializedActivityEvent[]; total: number }> {
    const whereClause: Prisma.ActivityEventWhereInput = {
      workspaceId,
      ...(options?.taskId ? { taskId: options.taskId } : {}),
      ...(options?.eventType ? { eventType: options.eventType as ActivityEventType } : {}),
    };

    const [events, total] = await Promise.all([
      prisma.activityEvent.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: options?.limit ? Math.min(options.limit, 100) : 50,
        skip: options?.offset ?? 0,
      }),
      prisma.activityEvent.count({ where: whereClause }),
    ]);

    return {
      activities: events.map(formatActivityEvent),
      total,
    };
  }
}

export const activityLogger = new ActivityLoggerService();
