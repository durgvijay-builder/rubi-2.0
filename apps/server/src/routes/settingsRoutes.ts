import { Router, type Request, type Response } from 'express';
import { workspaceAuth } from '../middleware/workspaceAuth.js';
import { taskService } from '../services/taskService.js';

export const settingsRoutes: Router = Router();

settingsRoutes.use(workspaceAuth);

/**
 * GET /api/user-settings
 * Returns user preferences (timezone, notifications).
 */
settingsRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const settings = await taskService.getUserSettings(workspaceId);
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: (error as Error).message });
  }
});

/**
 * PATCH /api/user-settings & PUT /api/user-settings
 * Updates preferences and customization defaults.
 */
const handleUpdateSettings = async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const {
      timezone,
      defaultScheduleReminderTime,
      defaultDeadlineReminderDaysBefore,
      defaultDeadlineReminderTime,
      customSlots,
      autoScheduleReminder,
      autoDeadlineReminder,
    } = req.body;

    if (timezone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
      } catch {
        res.status(400).json({ error: 'Bad Request', message: `Invalid IANA timezone: ${timezone}` });
        return;
      }
    }

    const settings = await taskService.updateUserSettings(workspaceId, {
      timezone,
      defaultScheduleReminderTime,
      defaultDeadlineReminderDaysBefore,
      defaultDeadlineReminderTime,
      customSlots,
      autoScheduleReminder,
      autoDeadlineReminder,
    });
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: (error as Error).message });
  }
};

settingsRoutes.patch('/', handleUpdateSettings);
settingsRoutes.put('/', handleUpdateSettings);

