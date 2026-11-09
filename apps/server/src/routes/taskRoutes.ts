import { Router, type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { workspaceAuth } from '../middleware/workspaceAuth.js';
import {
  taskService,
  CircularDependencyError,
  InvalidDependencyError,
  InvalidStatusOrPriorityError,
  ALLOWED_TASK_STATUSES,
  ALLOWED_TASK_PRIORITIES,
  ALLOWED_EFFORT_LEVELS,
} from '../services/taskService.js';

export const taskRoutes: Router = Router();

// Apply workspace authorization to all task routes
taskRoutes.use(workspaceAuth);

/**
 * GET /api/tasks
 * Query active or archived tasks for the authenticated workspace.
 * Supports segmented views: ALL, TODAY, UPCOMING, OVERDUE, COMPLETED, ARCHIVED.
 * Supports category filtering and deadline-first sorting.
 */
taskRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const { archived, view, category, status, priority, effort, assignee, search } = req.query;

    const result = await taskService.getTasks(workspaceId, {
      archived: archived as string,
      view: view as string,
      category: category as string,
      status: status as string,
      priority: priority as string,
      effort: effort as string,
      assignee: assignee as string,
      search: search as string,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: (error as Error).message });
  }
});

/**
 * POST /api/tasks/approve-all & POST /api/tasks/approve
 * Batch commit candidate tasks from HITL queue. Kahn's cycle check rejects circular dependencies with 422.
 */
const handleApproveBatch = async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const tasks = req.body.tasks || (Array.isArray(req.body) ? req.body : [req.body]);

    const createdTasks = await taskService.batchCommitTasks(workspaceId, null, tasks);

    res.status(201).json({
      success: true,
      tasks: createdTasks,
      message: `Successfully approved and persisted ${createdTasks.length} tasks.`,
    });
  } catch (error) {
    if (error instanceof CircularDependencyError || error instanceof InvalidDependencyError) {
      res.status(422).json({
        error: 'Unprocessable Entity',
        message: error.message,
      });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      res.status(422).json({
        error: 'Unprocessable Entity',
        message: 'Referenced prerequisite task does not exist in workspace.',
      });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error', message: (error as Error).message });
  }
};

taskRoutes.post('/approve-all', handleApproveBatch);
taskRoutes.post('/approve', handleApproveBatch);

/**
 * POST /api/tasks
 * Create single task or batch tasks.
 */
taskRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;

    if (req.body.tasks && Array.isArray(req.body.tasks)) {
      return await handleApproveBatch(req, res);
    }

    if (!req.body.title || typeof req.body.title !== 'string') {
      res.status(400).json({ error: 'Bad Request', message: 'Task title is required.' });
      return;
    }

    const task = await taskService.createSingleTask(workspaceId, null, req.body);
    res.status(201).json({ success: true, task });
  } catch (error) {
    if (error instanceof CircularDependencyError || error instanceof InvalidDependencyError) {
      res.status(422).json({
        error: 'Unprocessable Entity',
        message: error.message,
      });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      res.status(422).json({
        error: 'Unprocessable Entity',
        message: 'Referenced prerequisite task does not exist in workspace.',
      });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error', message: (error as Error).message });
  }
});

/**
 * GET /api/tasks/:id/dependencies
 * Returns dependency graph for specific task.
 */
taskRoutes.get('/:id/dependencies', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const taskId = String(req.params.id);
    const deps = await taskService.getTaskDependencies(workspaceId, taskId);

    if (!deps) {
      res.status(404).json({ error: 'Not Found', message: `Task ${taskId} not found.` });
      return;
    }

    res.json(deps);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: (error as Error).message });
  }
});

/**
 * PATCH /api/tasks/:id & PUT /api/tasks/:id
 * Updates task fields, status, or soft archival. Cascades unblocking when COMPLETED.
 */
const handleUpdateTask = async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const taskId = String(req.params.id);
    const { status, priority, effort } = req.body;

    if (status !== undefined && !ALLOWED_TASK_STATUSES.has(status)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid status or priority value',
      });
      return;
    }

    if (priority !== undefined && !ALLOWED_TASK_PRIORITIES.has(priority)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid status or priority value',
      });
      return;
    }

    if (effort !== undefined && !ALLOWED_EFFORT_LEVELS.has(effort)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid status or priority value',
      });
      return;
    }

    const task = await taskService.updateTask(workspaceId, taskId, req.body);
    res.json({ success: true, task });
  } catch (error) {
    if (error instanceof InvalidStatusOrPriorityError) {
      res.status(400).json({
        error: 'Bad Request',
        message: error.message,
      });
      return;
    }
    const msg = (error as Error).message;
    if (msg.includes('not found')) {
      res.status(404).json({ error: 'Not Found', message: msg });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
};

taskRoutes.patch('/:id', handleUpdateTask);
taskRoutes.put('/:id', handleUpdateTask);

/**
 * POST /api/tasks/:id/archive
 * Soft archives task.
 */
taskRoutes.post('/:id/archive', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const taskId = String(req.params.id);
    const task = await taskService.archiveTask(workspaceId, taskId);
    res.json({ success: true, task });
  } catch (error) {
    const msg = (error as Error).message;
    if (msg.includes('not found')) {
      res.status(404).json({ error: 'Not Found', message: msg });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});

/**
 * POST /api/tasks/:id/restore
 * Restores soft-archived task.
 */
taskRoutes.post('/:id/restore', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const taskId = String(req.params.id);
    const task = await taskService.restoreTask(workspaceId, taskId);
    res.json({ success: true, task });
  } catch (error) {
    const msg = (error as Error).message;
    if (msg.includes('not found')) {
      res.status(404).json({ error: 'Not Found', message: msg });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});

/**
 * DELETE /api/tasks/:id
 * Supports ?permanent=true for atomic hard deletion with activity log snapshot,
 * or soft archival by default.
 */
taskRoutes.delete('/:id', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const taskId = String(req.params.id);
    const permanent = req.query.permanent === 'true';
    const success = await taskService.deleteTask(workspaceId, taskId, permanent);

    if (!success) {
      res.status(404).json({ error: 'Not Found', message: `Task ${taskId} not found.` });
      return;
    }

    res.json({
      success: true,
      message: permanent ? 'Task permanently deleted.' : 'Task archived successfully.',
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: (error as Error).message });
  }
});

// ── Subtask Routes ───────────────────────────────────────────────────────────

/**
 * POST /api/tasks/:id/subtasks
 * Adds a new subtask to a task.
 */
taskRoutes.post('/:id/subtasks', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const taskId = String(req.params.id);
    const { title, order } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'Bad Request', message: 'Subtask title is required.' });
      return;
    }

    const subtask = await taskService.addSubtask(workspaceId, taskId, title, order);
    res.status(201).json({ success: true, subtask });
  } catch (error) {
    const msg = (error as Error).message;
    if (msg.includes('not found')) {
      res.status(404).json({ error: 'Not Found', message: msg });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});

/**
 * PATCH /api/tasks/:id/subtasks/:subtaskId
 * Updates a subtask (toggle completion, rename, reorder).
 */
taskRoutes.patch('/:id/subtasks/:subtaskId', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const taskId = String(req.params.id);
    const subtaskId = String(req.params.subtaskId);

    const subtask = await taskService.updateSubtask(workspaceId, taskId, subtaskId, req.body);
    res.json({ success: true, subtask });
  } catch (error) {
    const msg = (error as Error).message;
    if (msg.includes('not found')) {
      res.status(404).json({ error: 'Not Found', message: msg });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});

/**
 * DELETE /api/tasks/:id/subtasks/:subtaskId
 * Removes a subtask.
 */
taskRoutes.delete('/:id/subtasks/:subtaskId', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const taskId = String(req.params.id);
    const subtaskId = String(req.params.subtaskId);

    const success = await taskService.deleteSubtask(workspaceId, taskId, subtaskId);
    if (!success) {
      res.status(404).json({ error: 'Not Found', message: `Subtask ${subtaskId} not found.` });
      return;
    }

    res.json({ success: true, message: 'Subtask deleted successfully.' });
  } catch (error) {
    const msg = (error as Error).message;
    if (msg.includes('not found')) {
      res.status(404).json({ error: 'Not Found', message: msg });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error', message: msg });
  }
});
