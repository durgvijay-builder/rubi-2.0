import { Router, type Request, type Response, type NextFunction } from 'express';
import { routineService } from '../services/routineService.js';
import { CreateRoutineSchema, UpdateRoutineSchema } from '@rubi/shared';

export const routineRoutes: Router = Router();

// GET /api/routines - List routines for workspace
routineRoutes.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspace!.id;
    const { isActive, dateStr } = req.query;

    const options: { isActive?: boolean | undefined; dateStr?: string | undefined } = {};
    if (isActive !== undefined) options.isActive = isActive === 'true';
    if (typeof dateStr === 'string') options.dateStr = dateStr;

    const routines = await routineService.getRoutines(workspaceId, options);

    res.json({ data: routines });
  } catch (error) {
    next(error);
  }
});

// GET /api/routines/occurrences/weekly - Get occurrences for a week range
routineRoutes.get('/occurrences/weekly', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspace!.id;
    const { startDate, endDate } = req.query;

    if (typeof startDate !== 'string' || typeof endDate !== 'string') {
      res.status(400).json({ error: 'startDate and endDate query parameters are required (YYYY-MM-DD)' });
      return;
    }

    const occurrences = await routineService.getOccurrencesForRange(workspaceId, startDate, endDate);
    res.json({ data: occurrences });
  } catch (error) {
    next(error);
  }
});

// POST /api/routines - Create new routine
routineRoutes.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspace!.id;
    const parseResult = CreateRoutineSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation Error',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const routine = await routineService.createRoutine(workspaceId, parseResult.data);
    res.status(201).json({ data: routine });
  } catch (error) {
    next(error);
  }
});

// GET /api/routines/:id - Get routine by ID
routineRoutes.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspace!.id;
    const routineId = String(req.params.id);
    const routine = await routineService.getRoutineById(workspaceId, routineId);
    if (!routine) {
      res.status(404).json({ error: 'Routine not found' });
      return;
    }

    res.json({ data: routine });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/routines/:id - Update routine
routineRoutes.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspace!.id;
    const routineId = String(req.params.id);
    const parseResult = UpdateRoutineSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation Error',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const updated = await routineService.updateRoutine(workspaceId, routineId, parseResult.data);
    if (!updated) {
      res.status(404).json({ error: 'Routine not found' });
      return;
    }

    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/routines/:id - Delete routine
routineRoutes.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspace!.id;
    const routineId = String(req.params.id);
    const deleted = await routineService.deleteRoutine(workspaceId, routineId);
    if (!deleted) {
      res.status(404).json({ error: 'Routine not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// POST /api/routines/:id/occurrences - Toggle occurrence completion for a date
routineRoutes.post('/:id/occurrences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspace!.id;
    const routineId = String(req.params.id);
    const { date, status, notes } = req.body;

    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'Valid date is required (YYYY-MM-DD)' });
      return;
    }

    const result = await routineService.toggleOccurrence(
      workspaceId,
      routineId,
      date,
      status || 'COMPLETED',
      notes
    );

    res.json({ data: result });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
});
