import { prisma } from '../db.js';
import {
  type CreateRoutineDTO,
  type UpdateRoutineDTO,
  type RoutineEntity,
} from '@rubi/shared';

export class RoutineService {
  /**
   * Creates a new recurring routine.
   */
  async createRoutine(workspaceId: string, data: CreateRoutineDTO): Promise<RoutineEntity> {
    const routine = await prisma.routine.create({
      data: {
        workspaceId,
        title: data.title,
        description: data.description ?? null,
        category: data.category ?? null,
        frequency: data.frequency ?? 'DAILY',
        daysOfWeek: data.daysOfWeek ?? [1, 2, 3, 4, 5, 6, 7],
        slot: data.slot ?? 'Not decided',
        time: data.time ?? null,
        isActive: data.isActive ?? true,
        targetPerWeek: data.targetPerWeek ?? null,
        reminderTime: data.reminderTime ?? null,
      },
      include: {
        occurrences: {
          take: 7,
          orderBy: { date: 'desc' },
        },
      },
    });

    return {
      ...routine,
      createdAt: routine.createdAt.toISOString(),
      updatedAt: routine.updatedAt.toISOString(),
      occurrences: routine.occurrences.map((o) => ({
        ...o,
        completedAt: o.completedAt?.toISOString() ?? null,
        createdAt: o.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Retrieves all routines for a workspace, optionally evaluating completion for a given date.
   */
  async getRoutines(
    workspaceId: string,
    options?: { isActive?: boolean | undefined; dateStr?: string | undefined }
  ): Promise<RoutineEntity[]> {
    const where: any = { workspaceId };
    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    const routines = await prisma.routine.findMany({
      where,
      include: {
        occurrences: {
          orderBy: { date: 'desc' },
          take: 14,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const targetDate = options?.dateStr || new Date().toISOString().split('T')[0];

    return routines.map((r) => {
      const isCompletedToday = r.occurrences.some(
        (o) => o.date === targetDate && o.status === 'COMPLETED'
      );

      return {
        id: r.id,
        workspaceId: r.workspaceId,
        title: r.title,
        description: r.description,
        category: r.category,
        frequency: r.frequency,
        daysOfWeek: r.daysOfWeek,
        slot: r.slot,
        time: r.time,
        isActive: r.isActive,
        targetPerWeek: r.targetPerWeek,
        reminderTime: r.reminderTime,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        completedToday: isCompletedToday,
        occurrences: r.occurrences.map((o) => ({
          id: o.id,
          routineId: o.routineId,
          date: o.date,
          status: o.status,
          completedAt: o.completedAt?.toISOString() ?? null,
          notes: o.notes,
          createdAt: o.createdAt.toISOString(),
        })),
      };
    });
  }

  /**
   * Retrieves a single routine by ID.
   */
  async getRoutineById(workspaceId: string, routineId: string): Promise<RoutineEntity | null> {
    const routine = await prisma.routine.findFirst({
      where: { id: routineId, workspaceId },
      include: {
        occurrences: {
          orderBy: { date: 'desc' },
          take: 30,
        },
      },
    });

    if (!routine) return null;

    const todayStr = new Date().toISOString().split('T')[0];
    const isCompletedToday = routine.occurrences.some(
      (o) => o.date === todayStr && o.status === 'COMPLETED'
    );

    return {
      ...routine,
      createdAt: routine.createdAt.toISOString(),
      updatedAt: routine.updatedAt.toISOString(),
      completedToday: isCompletedToday,
      occurrences: routine.occurrences.map((o) => ({
        ...o,
        completedAt: o.completedAt?.toISOString() ?? null,
        createdAt: o.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Updates routine metadata. Preserves historical completion records.
   */
  async updateRoutine(
    workspaceId: string,
    routineId: string,
    patch: UpdateRoutineDTO
  ): Promise<RoutineEntity | null> {
    const existing = await prisma.routine.findFirst({
      where: { id: routineId, workspaceId },
    });
    if (!existing) return null;

    const data: any = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.category !== undefined) data.category = patch.category;
    if (patch.frequency !== undefined) data.frequency = patch.frequency;
    if (patch.daysOfWeek !== undefined) data.daysOfWeek = patch.daysOfWeek;
    if (patch.slot !== undefined) data.slot = patch.slot;
    if (patch.time !== undefined) data.time = patch.time;
    if (patch.isActive !== undefined) data.isActive = patch.isActive;
    if (patch.targetPerWeek !== undefined) data.targetPerWeek = patch.targetPerWeek;
    if (patch.reminderTime !== undefined) data.reminderTime = patch.reminderTime;

    const updated = await prisma.routine.update({
      where: { id: routineId },
      data,
      include: {
        occurrences: {
          orderBy: { date: 'desc' },
          take: 14,
        },
      },
    });

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      occurrences: updated.occurrences.map((o: any) => ({
        ...o,
        completedAt: o.completedAt ? o.completedAt.toISOString() : null,
        createdAt: o.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Deletes a routine and cascades to occurrences and reminders.
   */
  async deleteRoutine(workspaceId: string, routineId: string): Promise<boolean> {
    const existing = await prisma.routine.findFirst({
      where: { id: routineId, workspaceId },
    });
    if (!existing) return false;

    await prisma.routine.delete({
      where: { id: routineId },
    });

    return true;
  }

  /**
   * Toggles routine completion for a given date (YYYY-MM-DD).
   * If already completed, removes the occurrence (undo).
   * If not completed, records an occurrence with COMPLETED.
   */
  async toggleOccurrence(
    workspaceId: string,
    routineId: string,
    dateStr: string,
    status: 'COMPLETED' | 'SKIPPED' = 'COMPLETED',
    notes?: string
  ): Promise<{ action: 'added' | 'removed' | 'updated'; occurrence: any | null }> {
    const routine = await prisma.routine.findFirst({
      where: { id: routineId, workspaceId },
    });
    if (!routine) {
      throw new Error('Routine not found in active workspace');
    }

    const existing = await prisma.routineOccurrence.findUnique({
      where: {
        routineId_date: {
          routineId,
          date: dateStr,
        },
      },
    });

    if (existing) {
      if (existing.status === status) {
        // Toggle off (undo)
        await prisma.routineOccurrence.delete({
          where: { id: existing.id },
        });
        return { action: 'removed', occurrence: null };
      } else {
        // Update status (e.g. from SKIPPED to COMPLETED)
        const updated = await prisma.routineOccurrence.update({
          where: { id: existing.id },
          data: {
            status,
            completedAt: status === 'COMPLETED' ? new Date() : null,
            notes: notes ?? existing.notes,
          },
        });
        return { action: 'updated', occurrence: updated };
      }
    }

    // Create new occurrence
    const created = await prisma.routineOccurrence.create({
      data: {
        routineId,
        date: dateStr,
        status,
        completedAt: status === 'COMPLETED' ? new Date() : null,
        notes: notes ?? null,
      },
    });

    return { action: 'added', occurrence: created };
  }

  /**
   * Retrieves occurrences for a date range (e.g. current week).
   */
  async getOccurrencesForRange(
    workspaceId: string,
    startDateStr: string,
    endDateStr: string
  ): Promise<any[]> {
    const occurrences = await prisma.routineOccurrence.findMany({
      where: {
        routine: { workspaceId },
        date: {
          gte: startDateStr,
          lte: endDateStr,
        },
      },
      include: {
        routine: {
          select: {
            id: true,
            title: true,
            category: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    return occurrences;
  }
}

export const routineService = new RoutineService();
