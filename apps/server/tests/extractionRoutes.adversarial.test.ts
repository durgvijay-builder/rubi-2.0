import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { prisma } from '../src/db.js';
import { DEFAULT_WORKSPACE_ID } from '../prisma/seed.js';

describe('Adversarial & Boundary Tests: Semantic Extraction Routes', () => {
  beforeAll(async () => {
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Gnani AI Showcase', slug: 'gnani-ai-showcase' },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('DAG Boundary Conditions', () => {
    it('TC-BOUND-04: detects circular dependency (Alpha <-> Beta) and returns cycle metadata', async () => {
      const circularTranscript =
        'Task Alpha is blocked by Task Beta, and Task Beta is blocked by Task Alpha.';

      const res = await request(app)
        .post('/api/extract')
        .set('x-workspace-id', DEFAULT_WORKSPACE_ID)
        .send({ transcript: circularTranscript });

      expect(res.status).toBe(200);
      expect(res.body.hasCycle).toBe(true);
      expect(res.body.cycleNodes).toBeDefined();
      expect(res.body.cycleNodes.length).toBeGreaterThanOrEqual(2);
      expect(res.body.cycleError).toMatch(/circular dependency detected/i);

      // Verify tasks in cycle are marked with cycleError
      const alpha = res.body.tasks.find((t: any) => t.title.includes('Alpha'));
      const beta = res.body.tasks.find((t: any) => t.title.includes('Beta'));
      expect(alpha?.cycleError).toBe(true);
      expect(beta?.cycleError).toBe(true);
    });

    it('TC-BOUND-05: strips self-referencing dependency and records ambiguity warning', async () => {
      const selfDepTranscript = 'Task Gamma must be completed before Task Gamma can start.';

      const res = await request(app)
        .post('/api/extract')
        .set('x-workspace-id', DEFAULT_WORKSPACE_ID)
        .send({ transcript: selfDepTranscript });

      expect(res.status).toBe(200);
      expect(res.body.hasCycle).toBe(false);
      expect(res.body.tasks.length).toBe(1);

      const gamma = res.body.tasks[0];
      expect(gamma.dependencies).toEqual([]);
      expect(gamma.ambiguities.length).toBeGreaterThan(0);
      expect(gamma.ambiguities[0]).toMatch(/self-referencing/i);
    });
  });

  describe('Security & Injection Hardening', () => {
    it('rejects SQL injection in x-workspace-id header with 403 Forbidden', async () => {
      const injectionHeaders = [
        "1' OR '1'='1",
        "'; DROP TABLE workspaces; --",
        "workspace-id' UNION SELECT * FROM users --",
      ];

      for (const header of injectionHeaders) {
        const res = await request(app)
          .post('/api/extract')
          .set('x-workspace-id', header)
          .send({ transcript: 'Mark task #1 as completed.' });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('WORKSPACE_UNAUTHORIZED');
      }
    });

    it('handles direct command targeting a non-existent task gracefully', async () => {
      const res = await request(app)
        .post('/api/extract')
        .set('x-workspace-id', DEFAULT_WORKSPACE_ID)
        .send({ transcript: 'Mark task #99999 as completed.' });

      expect(res.status).toBe(200);
      expect(res.body.bypassLLM).toBe(true);
      expect(res.body.intent).toBe('MARK_COMPLETED');
      expect(res.body.tokensUsed.totalTokens).toBe(0);
    });

    it('handles large transcript without crashing', async () => {
      const largeTranscript = 'Discussion item: ' + 'architecture meeting planning sync. '.repeat(100);

      const res = await request(app)
        .post('/api/extract')
        .set('x-workspace-id', DEFAULT_WORKSPACE_ID)
        .send({ transcript: largeTranscript });

      expect(res.status).toBe(200);
      expect(res.body.tasks.length).toBeGreaterThanOrEqual(1);
      expect(res.body.tokensUsed.totalTokens).toBeGreaterThan(0);
    });
  });
});
