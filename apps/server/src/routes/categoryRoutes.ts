import { Router, type Request, type Response } from 'express';
import { workspaceAuth } from '../middleware/workspaceAuth.js';
import { taskService } from '../services/taskService.js';

export const categoryRoutes: Router = Router();

categoryRoutes.use(workspaceAuth);

/**
 * GET /api/categories
 * Returns all categories for the current workspace.
 */
categoryRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const categories = await taskService.getCategories(workspaceId);
    res.json({ success: true, categories });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: (error as Error).message });
  }
});

/**
 * POST /api/categories
 * Adds or updates a personal task category.
 */
categoryRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const { name, color } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Bad Request', message: 'Category name is required.' });
      return;
    }

    const category = await taskService.createCategory(workspaceId, name, color);
    res.status(201).json({ success: true, category });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: (error as Error).message });
  }
});

/**
 * PATCH /api/categories/:id
 * Updates category name and/or color.
 */
categoryRoutes.patch('/:id', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const categoryId = String(req.params.id);
    const { name, color } = req.body;

    const updated = await taskService.updateCategory(workspaceId, categoryId, { name, color });
    if (!updated) {
      res.status(404).json({ error: 'Not Found', message: `Category ${categoryId} not found.` });
      return;
    }

    res.json({ success: true, category: updated });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: (error as Error).message });
  }
});

/**
 * DELETE /api/categories/:id
 * Deletes a category.
 */
categoryRoutes.delete('/:id', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const categoryId = String(req.params.id);

    const success = await taskService.deleteCategory(workspaceId, categoryId);
    if (!success) {
      res.status(404).json({ error: 'Not Found', message: `Category ${categoryId} not found.` });
      return;
    }

    res.json({ success: true, message: 'Category deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: (error as Error).message });
  }
});

