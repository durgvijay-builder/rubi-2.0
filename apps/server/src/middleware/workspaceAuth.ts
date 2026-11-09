import type { Request, Response, NextFunction } from 'express';
import type { Workspace } from '@prisma/client';
import { prisma } from '../db.js';

declare global {
  namespace Express {
    interface Request {
      workspace?: Workspace;
    }
  }
}

/**
 * Multi-Tenant Workspace Authorization Middleware.
 * Validates incoming `x-workspace-id` header against PostgreSQL Workspace table.
 * Returns 401 if header is missing, 403 if invalid or unauthorized.
 */
export async function workspaceAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const workspaceIdHeader = req.headers['x-workspace-id'];

  if (!workspaceIdHeader || typeof workspaceIdHeader !== 'string' || workspaceIdHeader.trim() === '') {
    res.status(401).json({
      error: 'Missing x-workspace-id header',
      code: 'WORKSPACE_HEADER_MISSING',
    });
    return;
  }

  const workspaceId = workspaceIdHeader.trim();

  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Unauthorized workspace access: cross-workspace query rejected for ${workspaceId}`,
        code: 'WORKSPACE_UNAUTHORIZED',
        workspaceId,
      });
      return;
    }

    req.workspace = workspace;
    next();
  } catch (error) {
    next(error);
  }
}
