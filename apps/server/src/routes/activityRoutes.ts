import { Router, type Request, type Response } from 'express';
import { workspaceAuth } from '../middleware/workspaceAuth.js';
import { activityLogger } from '../services/activityLogger.js';

export const activityRoutes: Router = Router();

// Apply workspace authorization
activityRoutes.use(workspaceAuth);

/**
 * GET /api/activity & GET /api/activities
 * Retrieve chronological activity audit events for workspace.
 */
activityRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const { taskId, eventType, limit, offset } = req.query;

    const result = await activityLogger.getActivities(workspaceId, {
      taskId: taskId as string,
      eventType: eventType as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: (error as Error).message });
  }
});
