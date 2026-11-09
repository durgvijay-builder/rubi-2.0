import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { prisma } from '../src/db.js';
import { DEFAULT_WORKSPACE_ID } from '../prisma/seed.js';

describe('Server API & Workspace Authorization Middleware', () => {
  beforeAll(async () => {
    // Ensure test workspace exists
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: { name: 'Gnani AI Showcase', slug: 'gnani-ai-showcase' },
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Gnani AI Showcase', slug: 'gnani-ai-showcase' },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('GET /api/health', () => {
    it('returns status ok, timestamp, and server mode', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
      expect(typeof res.body.uptime).toBe('number');
    });
  });

  describe('GET /api/workspace (Workspace Authorization Middleware)', () => {
    it('returns 401 Unauthorized when x-workspace-id header is missing', async () => {
      const res = await request(app).get('/api/workspace');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Missing x-workspace-id header');
      expect(res.body.code).toBe('WORKSPACE_HEADER_MISSING');
    });

    it('returns 403 Forbidden when x-workspace-id does not exist', async () => {
      const res = await request(app)
        .get('/api/workspace')
        .set('x-workspace-id', '00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
      expect(res.body.code).toBe('WORKSPACE_UNAUTHORIZED');
    });

    it('returns 200 and workspace details when valid x-workspace-id is supplied', async () => {
      const res = await request(app)
        .get('/api/workspace')
        .set('x-workspace-id', DEFAULT_WORKSPACE_ID);
      expect(res.status).toBe(200);
      expect(res.body.workspace).toBeDefined();
      expect(res.body.workspace.id).toBe(DEFAULT_WORKSPACE_ID);
      expect(res.body.workspace.name).toBe('Gnani AI Showcase');
    });
  });
});
