import { Router, type Request, type Response, type NextFunction } from 'express';
import { routeIntent } from '@rubi/shared';
import { prisma } from '../db.js';
import { workspaceAuth } from '../middleware/workspaceAuth.js';
import {
  extractionService as defaultExtractionService,
  ExtractionService,
} from '../services/extractionService.js';
import { providerStatusService } from '../services/providerStatusService.js';

export function createExtractionRouter(
  service: ExtractionService = defaultExtractionService
): Router {
  const router = Router();

  // Protect all extraction endpoints with workspaceAuth middleware
  router.use(workspaceAuth);

  /**
   * POST /api/extract & /api/ai/extract
   *
   * Evaluates incoming transcript:
   * 1. Deterministic intent routing (bypasses LLM with 0 tokens if direct command)
   * 2. Gemini structured action extraction with Kahn's DAG cycle detection
   */
  router.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { transcript, context } = req.body || {};

      // 1. Boundary check: transcript must be non-empty string
      if (
        transcript === undefined ||
        transcript === null ||
        typeof transcript !== 'string' ||
        transcript.trim() === ''
      ) {
        res.status(400).json({
          error: 'Transcript is required',
          message: 'The transcript field must be a non-empty string.',
        });
        return;
      }

      const workspace = req.workspace;
      if (!workspace) {
        res.status(403).json({
          error: 'Invalid or unauthorized workspace',
          code: 'WORKSPACE_UNAUTHORIZED',
        });
        return;
      }

      // 2. Classify intent deterministically
      const intentResult = routeIntent(transcript);

      // 3. Handle Zero-Token Bypass for direct commands
      if (intentResult.bypassLLM) {
        if (intentResult.intent === 'MARK_COMPLETED') {
          // Look up matching task in workspace
          const rawId = intentResult.taskId;
          const targetId = intentResult.targetTaskId;

          let targetTask = await prisma.task.findFirst({
            where: {
              workspaceId: workspace.id,
              OR: [
                ...(targetId ? [{ id: targetId }] : []),
                ...(rawId ? [{ id: rawId }] : []),
              ],
            },
          });

          // Fallback lookup if numeric ordinal: e.g. "task #3" -> 3rd task
          if (!targetTask && rawId && /^\d+$/.test(rawId)) {
            const index = parseInt(rawId, 10) - 1;
            const tasksInWs = await prisma.task.findMany({
              where: { workspaceId: workspace.id },
              orderBy: { createdAt: 'asc' },
            });
            if (index >= 0 && index < tasksInWs.length) {
              targetTask = tasksInWs[index] ?? null;
            }
          }

          if (targetTask) {
            const prevStatus = targetTask.status;
            await prisma.$transaction(async (tx) => {
              await tx.task.update({
                where: { id: targetTask!.id },
                data: { status: 'COMPLETED' },
              });

              await tx.activityEvent.create({
                data: {
                  workspaceId: workspace.id,
                  taskId: targetTask!.id,
                  eventType: 'TASK_STATUS_CHANGED',
                  description: `Task "${targetTask!.title}" marked as completed via direct voice command (0 tokens).`,
                  metadata: {
                    bypassLLM: true,
                    previousStatus: prevStatus,
                    newStatus: 'COMPLETED',
                  },
                },
              });
            });
          }

          res.status(200).json({
            bypassLLM: true,
            intent: 'MARK_COMPLETED',
            message: intentResult.message,
            affectedTaskId: targetTask?.id ?? targetId,
            tokensUsed: intentResult.tokensUsed,
          });
          return;
        }

        if (intentResult.intent === 'LIST_TASKS') {
          const pendingTasks = await prisma.task.findMany({
            where: {
              workspaceId: workspace.id,
              isArchived: false,
            },
            orderBy: { createdAt: 'asc' },
          });

          res.status(200).json({
            bypassLLM: true,
            intent: 'LIST_TASKS',
            tasks: pendingTasks,
            tokensUsed: intentResult.tokensUsed,
          });
          return;
        }

        if (intentResult.intent === 'CANCEL_TASK') {
          const rawId = intentResult.taskId;
          const targetId = intentResult.targetTaskId;

          const targetTask = await prisma.task.findFirst({
            where: {
              workspaceId: workspace.id,
              OR: [
                ...(targetId ? [{ id: targetId }] : []),
                ...(rawId ? [{ id: rawId }] : []),
              ],
            },
          });

          if (targetTask) {
            const prevStatus = targetTask.status;
            await prisma.$transaction(async (tx) => {
              await tx.task.update({
                where: { id: targetTask.id },
                data: { status: 'CANCELLED' },
              });

              await tx.activityEvent.create({
                data: {
                  workspaceId: workspace.id,
                  taskId: targetTask.id,
                  eventType: 'TASK_STATUS_CHANGED',
                  description: `Task "${targetTask.title}" cancelled via direct command.`,
                  metadata: {
                    bypassLLM: true,
                    previousStatus: prevStatus,
                    newStatus: 'CANCELLED',
                  },
                },
              });
            });
          }

          res.status(200).json({
            bypassLLM: true,
            intent: 'CANCEL_TASK',
            message: intentResult.message,
            affectedTaskId: targetTask?.id ?? targetId,
            tokensUsed: intentResult.tokensUsed,
          });
          return;
        }

        if (intentResult.intent === 'CANCEL_REMINDER') {
          const rawId = intentResult.taskId;
          const targetId = intentResult.targetTaskId;

          let targetTask = await prisma.task.findFirst({
            where: {
              workspaceId: workspace.id,
              OR: [
                ...(targetId ? [{ id: targetId }] : []),
                ...(rawId ? [{ id: rawId }] : []),
              ],
            },
          });

          if (!targetTask && rawId && /^\d+$/.test(rawId)) {
            const index = parseInt(rawId, 10) - 1;
            const tasksInWs = await prisma.task.findMany({
              where: { workspaceId: workspace.id },
              orderBy: { createdAt: 'asc' },
            });
            if (index >= 0 && index < tasksInWs.length) {
              targetTask = tasksInWs[index] ?? null;
            }
          }

          if (targetTask) {
            await prisma.reminder.updateMany({
              where: {
                taskId: targetTask.id,
                status: 'PENDING',
              },
              data: {
                status: 'CANCELLED',
              },
            });
          } else if (rawId) {
            await prisma.reminder.updateMany({
              where: {
                id: rawId,
                status: 'PENDING',
              },
              data: {
                status: 'CANCELLED',
              },
            });
          }

          res.status(200).json({
            bypassLLM: true,
            intent: 'CANCEL_REMINDER',
            message: intentResult.message,
            affectedTaskId: targetTask?.id ?? targetId,
            tokensUsed: intentResult.tokensUsed,
          });
          return;
        }
      }

      // 4. Natural Conversation Semantic Extraction
      try {
        const batch = await service.extractActions(transcript, {
          workspaceId: workspace.id,
          ...(typeof context === 'object' && context !== null ? context : {}),
        });

        providerStatusService.recordSuccess('gemini');
        res.status(200).json(batch);
      } catch (error) {
        providerStatusService.recordFailure('gemini', error);
        next(error);
      }
    } catch (outerError) {
      next(outerError);
    }
  });

  return router;
}

export const extractionRoutes = createExtractionRouter();
