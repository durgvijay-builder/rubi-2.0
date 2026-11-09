import { Router, type Request, type Response } from 'express';
import { workspaceAuth } from '../middleware/workspaceAuth.js';
import { reminderService } from '../services/reminderService.js';
import { ReminderStatus } from '@prisma/client';

export const reminderRoutes: Router = Router();

reminderRoutes.use(workspaceAuth);

/**
 * GET /api/reminders
 * List reminders for workspace with optional status, taskId, or routineId filter.
 */
reminderRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const { status, taskId, routineId } = req.query;

    const filter: { status?: ReminderStatus | undefined; taskId?: string | undefined; routineId?: string | undefined } = {};
    if (typeof status === 'string' && status in ReminderStatus) filter.status = status as ReminderStatus;
    if (typeof taskId === 'string') filter.taskId = taskId;
    if (typeof routineId === 'string') filter.routineId = routineId;

    const reminders = await reminderService.getReminders(workspaceId, filter);

    res.json({ success: true, reminders });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: (error as Error).message });
  }
});

/**
 * POST /api/reminders
 * Create a custom reminder.
 */
reminderRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const { taskId, routineId, remindAt, message, type } = req.body;

    if (!remindAt) {
      res.status(400).json({ error: 'Bad Request', message: 'remindAt date is required.' });
      return;
    }

    const date = new Date(remindAt);
    if (isNaN(date.getTime())) {
      res.status(400).json({ error: 'Bad Request', message: 'Invalid remindAt date format.' });
      return;
    }

    const reminder = await reminderService.createReminder(workspaceId, {
      taskId: taskId ?? null,
      routineId: routineId ?? null,
      remindAt: date,
      message: message ?? undefined,
      type: type ?? 'custom',
    });

    res.status(201).json({ success: true, reminder });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      res.status(404).json({ error: 'Not Found', message: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

/**
 * PATCH /api/reminders/:id
 * Edit or reschedule a reminder.
 */
reminderRoutes.patch('/:id', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const { remindAt, message, status } = req.body;

    const patch: any = {};
    if (remindAt) {
      const date = new Date(remindAt);
      if (isNaN(date.getTime())) {
        res.status(400).json({ error: 'Bad Request', message: 'Invalid remindAt date format.' });
        return;
      }
      patch.remindAt = date;
    }
    if (message !== undefined) patch.message = message;
    if (status && status in ReminderStatus) patch.status = status as ReminderStatus;

    const reminderId = String(req.params.id);
    const updated = await reminderService.updateReminder(workspaceId, reminderId, patch);
    if (!updated) {
      res.status(404).json({ error: 'Not Found', message: 'Reminder not found.' });
      return;
    }

    res.json({ success: true, reminder: updated });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: (error as Error).message });
  }
});

/**
 * POST /api/reminders/:id/cancel
 * Cancels a reminder.
 */
reminderRoutes.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const reminderId = String(req.params.id);
    const cancelled = await reminderService.cancelReminder(workspaceId, reminderId);
    if (!cancelled) {
      res.status(404).json({ error: 'Not Found', message: 'Reminder not found.' });
      return;
    }

    res.json({ success: true, message: 'Reminder cancelled.' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: (error as Error).message });
  }
});

/**
 * DELETE /api/reminders/:id
 * Permanently deletes a reminder.
 */
reminderRoutes.delete('/:id', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const reminderId = String(req.params.id);
    const deleted = await reminderService.deleteReminder(workspaceId, reminderId);
    if (!deleted) {
      res.status(404).json({ error: 'Not Found', message: 'Reminder not found.' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: (error as Error).message });
  }
});

/**
 * GET /api/reminders/due
 * Fetches recent due reminders for in-app notifications.
 */
reminderRoutes.get('/due', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const due = await reminderService.getDueReminders(workspaceId);
    res.json({ success: true, reminders: due });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: (error as Error).message });
  }
});

/**
 * POST /api/reminders/subscribe
 * Registers browser push notification subscription.
 */
reminderRoutes.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const { endpoint, keys } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ error: 'Bad Request', message: 'Valid push subscription object required.' });
      return;
    }

    await reminderService.subscribePush(workspaceId, endpoint, keys.p256dh, keys.auth);
    res.status(201).json({ success: true, message: 'Push subscription registered.' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: (error as Error).message });
  }
});

/**
 * POST /api/reminders/unsubscribe
 */
reminderRoutes.post('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      await reminderService.unsubscribePush(endpoint);
    }
    res.json({ success: true, message: 'Push subscription removed.' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: (error as Error).message });
  }
});

/**
 * GET /api/reminders/vapid-key
 * Returns public VAPID key if available for Web Push.
 */
reminderRoutes.get('/vapid-key', (_req: Request, res: Response) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY || null;
  res.json({ publicKey });
});
