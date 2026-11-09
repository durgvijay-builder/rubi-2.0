import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { prisma } from '../src/db.js';
import { DEFAULT_WORKSPACE_ID, DEMO_OWNER_ID } from '../prisma/seed.js';
import {
  detectCycle,
  ExtractedActionBatchSchema,
} from '@rubi/shared';
import {
  MockGeminiExtractionAdapter,
  LiveGeminiExtractionAdapter,
  GeminiExtractionAdapter,
  EXTRACTION_FIXTURES,
  calculateGeminiCost,
  estimateTokenCount,
  GEMINI_FLASH_RATES,
  GEMINI_STANDARD_RATES,
} from '@rubi/mock-adapters';
import { ExtractionService } from '../src/services/extractionService.js';

describe('CHALLENGER 2 EMPIRICAL AUDIT: Milestone 4 Semantic Extraction & DAG Verification', () => {
  beforeAll(async () => {
    // Ensure default workspace and owner user exist in PostgreSQL
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Gnani AI Showcase', slug: 'gnani-ai-showcase' },
    });

    await prisma.user.upsert({
      where: { id: DEMO_OWNER_ID },
      update: {},
      create: {
        id: DEMO_OWNER_ID,
        workspaceId: DEFAULT_WORKSPACE_ID,
        email: 'durgvijay@gnani.ai',
        name: 'Durgvijay Chauhan',
        role: 'OWNER',
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ===========================================================================
  // SECTION 1: EMPIRICAL DAG CYCLE DETECTION & TOPOLOGY STRESS TESTS
  // ===========================================================================
  describe('Scope 1: DAG Cycle Detection & Topologies', () => {
    it('1.1: 2-node cycle (A <-> B) correctly detected with cycleNodes: [A, B]', () => {
      const tasks = [
        { tempId: 'node-A', dependencies: ['node-B'] },
        { tempId: 'node-B', dependencies: ['node-A'] },
      ];

      const result = detectCycle(tasks);
      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodes).toBeDefined();
      expect(result.cycleNodes).toHaveLength(2);
      expect(result.cycleNodes).toContain('node-A');
      expect(result.cycleNodes).toContain('node-B');
      expect(result.sortedOrder).toBeUndefined();
    });

    it('1.2: 3-node cycle (A -> B -> C -> A) correctly detected with cycleNodes: [A, B, C]', () => {
      // In Kahn's: dependencies = prerequisites.
      // B depends on A, C depends on B, A depends on C => cycle A -> B -> C -> A
      const tasks = [
        { tempId: 'node-A', dependencies: ['node-C'] },
        { tempId: 'node-B', dependencies: ['node-A'] },
        { tempId: 'node-C', dependencies: ['node-B'] },
      ];

      const result = detectCycle(tasks);
      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodes).toBeDefined();
      expect(result.cycleNodes).toHaveLength(3);
      expect(result.cycleNodes).toEqual(expect.arrayContaining(['node-A', 'node-B', 'node-C']));
      expect(result.sortedOrder).toBeUndefined();
    });

    it('1.3: Disconnected components: valid chain + 2-node cycle', () => {
      // Valid chain: V1 -> V2 -> V3
      // Cyclic component: C1 <-> C2
      const tasks = [
        { tempId: 'V1', dependencies: [] },
        { tempId: 'V2', dependencies: ['V1'] },
        { tempId: 'V3', dependencies: ['V2'] },
        { tempId: 'C1', dependencies: ['C2'] },
        { tempId: 'C2', dependencies: ['C1'] },
      ];

      const result = detectCycle(tasks);
      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodes).toBeDefined();
      expect(result.cycleNodes).toHaveLength(2);
      expect(result.cycleNodes).toEqual(expect.arrayContaining(['C1', 'C2']));
      expect(result.cycleNodes).not.toContain('V1');
      expect(result.cycleNodes).not.toContain('V2');
      expect(result.cycleNodes).not.toContain('V3');
    });

    it('1.4: Disconnected components: two independent cycles in different subgraphs', () => {
      // Cycle 1: X1 <-> X2
      // Cycle 2: Y1 -> Y2 -> Y3 -> Y1
      // Valid solo: Z1
      const tasks = [
        { tempId: 'X1', dependencies: ['X2'] },
        { tempId: 'X2', dependencies: ['X1'] },
        { tempId: 'Y1', dependencies: ['Y3'] },
        { tempId: 'Y2', dependencies: ['Y1'] },
        { tempId: 'Y3', dependencies: ['Y2'] },
        { tempId: 'Z1', dependencies: [] },
      ];

      const result = detectCycle(tasks);
      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodes).toBeDefined();
      expect(result.cycleNodes).toHaveLength(5);
      expect(result.cycleNodes).toEqual(expect.arrayContaining(['X1', 'X2', 'Y1', 'Y2', 'Y3']));
      expect(result.cycleNodes).not.toContain('Z1');
    });

    it('1.5: Lasso graph: acyclic stem leading into cyclic loop', () => {
      // Stem: S1 -> S2
      // Loop: S2 -> L1 <-> L2
      const tasks = [
        { tempId: 'S1', dependencies: [] },
        { tempId: 'S2', dependencies: ['S1'] },
        { tempId: 'L1', dependencies: ['S2', 'L2'] },
        { tempId: 'L2', dependencies: ['L1'] },
      ];

      const result = detectCycle(tasks);
      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodes).toEqual(expect.arrayContaining(['L1', 'L2']));
      expect(result.cycleNodes).not.toContain('S1');
      expect(result.cycleNodes).not.toContain('S2');
    });

    it('1.6: Boundary: empty graph, single isolated node, self-referencing task in detectCycle', () => {
      expect(detectCycle([])).toEqual({ hasCycle: false, sortedOrder: [] });

      const single = detectCycle([{ tempId: 'solo', dependencies: [] }]);
      expect(single.hasCycle).toBe(false);
      expect(single.sortedOrder).toEqual(['solo']);

      const selfDep = detectCycle([{ tempId: 'self', dependencies: ['self'] }]);
      expect(selfDep.hasCycle).toBe(true);
      expect(selfDep.cycleNodes).toEqual(['self']);
    });
  });

  // ===========================================================================
  // SECTION 2: EMPIRICAL SELF-DEPENDENCY HANDLING (TC-BOUND-05)
  // ===========================================================================
  describe('Scope 2: Self-Dependency Sanitization & Ambiguity Recording', () => {
    it('2.1: ExtractionService strips self-dependency and records ambiguity in item and batch', async () => {
      // Mock adapter that returns a task with self-dependency
      const mockAdapterWithSelfDep = {
        extractActions: vi.fn().mockResolvedValue({
          summary: 'Self dependency test',
          tasks: [
            {
              tempId: 'task-temp-gamma',
              title: 'Task Gamma',
              description: 'Self-referencing task',
              owner: 'Dev Gamma',
              priority: 'MEDIUM',
              deadline: null,
              dependencies: ['task-temp-gamma'],
              status: 'PENDING_APPROVAL',
              ambiguities: [],
            },
          ],
          ambiguities: [],
          tokensUsed: { promptTokens: 100, completionTokens: 50, totalTokens: 150, estimatedCostUsd: 0.00002 },
        }),
      };

      const service = new ExtractionService({ adapter: mockAdapterWithSelfDep });
      const batch = await service.extractActions('Task Gamma must finish before Task Gamma starts');

      // 1. Dependencies must be empty (self-dep stripped)
      expect(batch.tasks[0]?.dependencies).toEqual([]);
      // 2. hasCycle must be false (since self-dep was removed)
      expect(batch.hasCycle).toBe(false);
      // 3. Item ambiguities must record self-referencing removal
      expect(batch.tasks[0]?.ambiguities).toContain(
        'Self-referencing dependency was automatically removed'
      );
      // 4. Batch ambiguities must record self-referencing removal
      expect(batch.ambiguities).toContain(
        'Self-referencing dependency detected on Task Gamma and removed.'
      );
    });

    it('2.2: Strips multiple self-references and handles duplicate self-dep entries', async () => {
      const mockAdapterMultiSelf = {
        extractActions: vi.fn().mockResolvedValue({
          summary: 'Multiple self dependencies',
          tasks: [
            {
              tempId: 'task-alpha',
              title: 'Task Alpha',
              dependencies: ['task-alpha', 'task-alpha'],
              status: 'PENDING_APPROVAL',
              ambiguities: [],
            },
            {
              tempId: 'task-beta',
              title: 'Task Beta',
              dependencies: ['task-beta', 'task-alpha'],
              status: 'PENDING_APPROVAL',
              ambiguities: [],
            },
          ],
          ambiguities: [],
          tokensUsed: { promptTokens: 100, completionTokens: 50, totalTokens: 150, estimatedCostUsd: 0.00002 },
        }),
      };

      const service = new ExtractionService({ adapter: mockAdapterMultiSelf });
      const batch = await service.extractActions('Alpha and Beta self references');

      expect(batch.tasks[0]?.dependencies).toEqual([]);
      expect(batch.tasks[1]?.dependencies).toEqual(['task-alpha']);
      expect(batch.hasCycle).toBe(false);
      expect(batch.ambiguities.length).toBe(2);
      expect(batch.ambiguities).toContain(
        'Self-referencing dependency detected on Task Alpha and removed.'
      );
      expect(batch.ambiguities).toContain(
        'Self-referencing dependency detected on Task Beta and removed.'
      );
    });

    it('2.3: Coexistence of self-dependency removal AND actual 2-node cycle', async () => {
      // Task Gamma self-references AND mutually loops with Task Delta
      const mockAdapterSelfAndCycle = {
        extractActions: vi.fn().mockResolvedValue({
          summary: 'Self-dep plus real cycle',
          tasks: [
            {
              tempId: 'task-gamma',
              title: 'Task Gamma',
              dependencies: ['task-gamma', 'task-delta'],
              status: 'PENDING_APPROVAL',
              ambiguities: [],
            },
            {
              tempId: 'task-delta',
              title: 'Task Delta',
              dependencies: ['task-gamma'],
              status: 'PENDING_APPROVAL',
              ambiguities: [],
            },
          ],
          ambiguities: [],
          tokensUsed: { promptTokens: 100, completionTokens: 50, totalTokens: 150, estimatedCostUsd: 0.00002 },
        }),
      };

      const service = new ExtractionService({ adapter: mockAdapterSelfAndCycle });
      const batch = await service.extractActions('Gamma loops itself and Delta loops Gamma');

      // Gamma self-dependency must be stripped
      expect(batch.tasks[0]?.dependencies).toEqual(['task-delta']);
      // But the real cycle (Gamma <-> Delta) must still be detected!
      expect(batch.hasCycle).toBe(true);
      expect(batch.cycleNodes).toEqual(expect.arrayContaining(['Task Gamma', 'Task Delta']));
      expect(batch.tasks[0]?.cycleError).toBe(true);
      expect(batch.tasks[1]?.cycleError).toBe(true);
      // Both self-dep ambiguity and circular ambiguity must be recorded
      expect(batch.ambiguities.some((a) => a.includes('Self-referencing'))).toBe(true);
      expect(batch.ambiguities.some((a) => a.includes('Circular dependency'))).toBe(true);
    });

    it('2.4: HTTP endpoint POST /api/extract verifies TC-BOUND-05 live over Express & PostgreSQL', async () => {
      const res = await request(app)
        .post('/api/extract')
        .set('x-workspace-id', DEFAULT_WORKSPACE_ID)
        .send({ transcript: EXTRACTION_FIXTURES.SELF_DEPENDENCY_CASE.transcript });

      expect(res.status).toBe(200);
      expect(res.body.hasCycle).toBe(false);
      expect(res.body.tasks.length).toBe(1);
      expect(res.body.tasks[0].dependencies).toEqual([]);
      expect(res.body.tasks[0].ambiguities.length).toBeGreaterThan(0);
      expect(res.body.tasks[0].ambiguities[0]).toMatch(/self-referencing/i);
      expect(res.body.ambiguities.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // SECTION 3: EMPIRICAL TEST OF ALL 14 FIXTURES & DYNAMIC SYNTHESIS FALLBACK
  // ===========================================================================
  describe('Scope 3: MockGeminiExtractionAdapter All 14 Fixtures & Dynamic Fallback', () => {
    const adapter = new MockGeminiExtractionAdapter();

    const fixtureKeys = Object.keys(EXTRACTION_FIXTURES) as Array<keyof typeof EXTRACTION_FIXTURES>;

    it('verifies there are exactly 14 defined fixtures in EXTRACTION_FIXTURES', () => {
      expect(fixtureKeys).toHaveLength(14);
    });

    for (const key of fixtureKeys) {
      const fixture = EXTRACTION_FIXTURES[key];
      it(`matches fixture [${key}] with schema validation and faithful data replication`, async () => {
        const result = await adapter.extractActions(fixture.transcript);

        // Batch must strictly satisfy ExtractedActionBatchSchema
        const validated = ExtractedActionBatchSchema.safeParse(result);
        expect(validated.success).toBe(true);

        expect(result.summary).toBe(fixture.batch.summary);
        expect(result.tasks.length).toBe(fixture.batch.tasks.length);
        expect(result.tokensUsed.totalTokens).toBe(fixture.batch.tokensUsed.totalTokens);
        expect(result.tokensUsed.estimatedCostUsd).toBe(fixture.batch.tokensUsed.estimatedCostUsd);

        // Verify task attributes
        for (let i = 0; i < fixture.batch.tasks.length; i++) {
          const expectedTask = fixture.batch.tasks[i]!;
          const actualTask = result.tasks[i]!;
          expect(actualTask.tempId).toBe(expectedTask.tempId);
          expect(actualTask.title).toBe(expectedTask.title);
          expect(actualTask.owner).toBe(expectedTask.owner);
          expect(actualTask.priority).toBe(expectedTask.priority);
          expect(actualTask.dependencies).toEqual(expectedTask.dependencies);
        }
      });
    }

    it('3.15: Cache isolation / Immutability test: mutating returned batch does not corrupt fixture', async () => {
      const res1 = await adapter.extractActions(EXTRACTION_FIXTURES.EN_DATABASE_PIPELINE.transcript);
      expect(res1.tasks.length).toBe(2);

      // Mutate returned object
      res1.tasks.push({
        tempId: 'mutated-temp-id',
        title: 'Injected corrupt task',
        owner: 'Attacker',
        priority: 'CRITICAL',
        deadline: null,
        dependencies: [],
        status: 'PENDING_APPROVAL',
        ambiguities: [],
      });
      res1.summary = 'CORRUPTED';

      // Subsequent call must return untouched fresh clone
      const res2 = await adapter.extractActions(EXTRACTION_FIXTURES.EN_DATABASE_PIPELINE.transcript);
      expect(res2.tasks.length).toBe(2);
      expect(res2.summary).toBe(EXTRACTION_FIXTURES.EN_DATABASE_PIPELINE.batch.summary);
    });

    it('3.16: Arbitrary unknown transcripts trigger dynamic synthesis fallback', async () => {
      const arbitraryTranscripts = [
        'Deploy the payment gateway integration to staging environment and assign to Vikram.',
        'Hume kal tak logging service ko Elasticsearch ke saath connect karna hai jaldi se.',
        'Prepare slides for the board meeting, review the quarterly roadmap, and sync with product design.',
        'Random single thought without structure',
      ];

      for (const transcript of arbitraryTranscripts) {
        const result = await adapter.extractActions(transcript);

        const validated = ExtractedActionBatchSchema.safeParse(result);
        expect(validated.success).toBe(true);
        expect(result.tasks.length).toBeGreaterThanOrEqual(1);
        expect(result.tasks[0]?.tempId).toMatch(/^task-dyn-\d+$/);
        expect(result.tokensUsed.promptTokens).toBeGreaterThan(0);
        expect(result.tokensUsed.completionTokens).toBeGreaterThan(0);
        expect(result.tokensUsed.totalTokens).toBe(
          result.tokensUsed.promptTokens + result.tokensUsed.completionTokens
        );
        expect(result.tokensUsed.estimatedCostUsd).toBeGreaterThan(0);
      }
    });

    it('3.17: Edge input dynamic synthesis: whitespace, single character, long sentence', async () => {
      const emptyRes = await adapter.extractActions('     ');
      expect(emptyRes.tasks).toEqual([]);
      expect(emptyRes.tokensUsed.totalTokens).toBe(0);

      const singleCharRes = await adapter.extractActions('x');
      expect(singleCharRes.tasks.length).toBe(1);
      expect(ExtractedActionBatchSchema.safeParse(singleCharRes).success).toBe(true);

      const longText = 'Automate regression testing. '.repeat(50);
      const longRes = await adapter.extractActions(longText);
      expect(longRes.tasks.length).toBeGreaterThanOrEqual(1);
      expect(longRes.tasks.length).toBeLessThanOrEqual(3);
      expect(longRes.tokensUsed.promptTokens).toBeGreaterThan(150);
    });
  });

  // ===========================================================================
  // SECTION 4: EMPIRICAL TEST OF FACTORY FALLBACK BEHAVIOR (LIVE/OFFLINE/ERRORS)
  // ===========================================================================
  describe('Scope 4: GeminiExtractionAdapter Factory Fallback Behavior', () => {
    it('4.1: Operates in offline mode when mode: offline, no API key, or MOCK_SERVICES: true', () => {
      // 1. Explicit offline mode
      const factoryOffline = new GeminiExtractionAdapter({ mode: 'offline' });
      expect(factoryOffline.isLive).toBe(false);

      // 2. No API key provided
      const factoryNoKey = new GeminiExtractionAdapter({ mode: 'live', apiKey: '' });
      expect(factoryNoKey.isLive).toBe(false);

      // 3. MOCK_SERVICES env variable set to 'true' overrides live mode
      const origMockServices = process.env.MOCK_SERVICES;
      try {
        process.env.MOCK_SERVICES = 'true';
        const factoryMockServices = new GeminiExtractionAdapter({
          mode: 'live',
          apiKey: 'test-key',
        });
        expect(factoryMockServices.isLive).toBe(false);
      } finally {
        if (origMockServices === undefined) {
          delete process.env.MOCK_SERVICES;
        } else {
          process.env.MOCK_SERVICES = origMockServices;
        }
      }

      // 4. Live mode when key is present and MOCK_SERVICES is not true
      const origEnv = process.env.MOCK_SERVICES;
      delete process.env.MOCK_SERVICES;
      try {
        const factoryLive = new GeminiExtractionAdapter({
          mode: 'live',
          apiKey: 'valid-test-key',
        });
        expect(factoryLive.isLive).toBe(true);
      } finally {
        if (origEnv !== undefined) {
          process.env.MOCK_SERVICES = origEnv;
        }
      }
    });

    it('4.2: Falls back to Mock when live adapter fails with 500/503/429/network error', async () => {
      const mockLiveFail = {
        extractActions: vi.fn().mockRejectedValue(new Error('503 Service Unavailable: High load on Gemini model')),
      };

      const factory = new GeminiExtractionAdapter({
        mode: 'live',
        apiKey: 'dummy-api-key',
        liveAdapter: mockLiveFail as any,
        fallbackToMockOnError: true,
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await factory.extractActions(
        EXTRACTION_FIXTURES.EN_DATABASE_PIPELINE.transcript
      );

      expect(mockLiveFail.extractActions).toHaveBeenCalledTimes(1);
      // Transparent fallback succeeded with valid mock result
      expect(result.tasks.length).toBe(2);
      expect(result.tasks[0]?.title).toMatch(/postgresql database/i);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[GeminiExtractionAdapter] Live extraction failed')
      );

      warnSpy.mockRestore();
    });

    it('4.3: Falls back to Mock when live adapter returns malformed non-JSON output', async () => {
      const fetchMalJson = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: { parts: [{ text: 'Here is your task: not a json string!' }] },
            },
          ],
        }),
      });

      const liveAdapter = new LiveGeminiExtractionAdapter({
        apiKey: 'test-key',
        fetchFn: fetchMalJson as any,
      });

      const factory = new GeminiExtractionAdapter({
        mode: 'live',
        apiKey: 'test-key',
        liveAdapter,
        fallbackToMockOnError: true,
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await factory.extractActions(
        EXTRACTION_FIXTURES.EN_SINGLE_TASK.transcript
      );

      expect(result.tasks.length).toBe(1);
      expect(result.tasks[0]?.owner).toBe('Sarah');
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('4.4: Re-throws error when fallbackToMockOnError is explicitly false', async () => {
      const mockLiveFail = {
        extractActions: vi.fn().mockRejectedValue(new Error('ECONNREFUSED: Unable to reach Gemini')),
      };

      const factory = new GeminiExtractionAdapter({
        mode: 'live',
        apiKey: 'dummy-key',
        liveAdapter: mockLiveFail as any,
        fallbackToMockOnError: false,
      });

      await expect(factory.extractActions('Some transcript')).rejects.toThrow(
        /ECONNREFUSED/
      );
    });
  });

  // ===========================================================================
  // SECTION 5: EMPIRICAL TEST OF TOKEN & COST CALCULATION
  // ===========================================================================
  describe('Scope 5: Token & Cost Calculation Math', () => {
    describe('Gemini Flash Rates ($0.075 / $0.30 per 1M tokens)', () => {
      it('5.1: Zero tokens cost exactly 0 USD', () => {
        expect(calculateGeminiCost(0, 0, GEMINI_FLASH_RATES)).toBe(0);
      });

      it('5.2: 1M prompt tokens cost $0.075', () => {
        const cost = calculateGeminiCost(1_000_000, 0, GEMINI_FLASH_RATES);
        expect(cost).toBe(0.075);
      });

      it('5.3: 1M completion tokens cost $0.30', () => {
        const cost = calculateGeminiCost(0, 1_000_000, GEMINI_FLASH_RATES);
        expect(cost).toBe(0.3);
      });

      it('5.4: Exactly matches all 14 test fixture precomputed costs', () => {
        const fixtures = Object.values(EXTRACTION_FIXTURES);
        for (const f of fixtures) {
          const { promptTokens, completionTokens, estimatedCostUsd } = f.batch.tokensUsed;
          const calculated = calculateGeminiCost(promptTokens, completionTokens, GEMINI_FLASH_RATES);
          expect(calculated).toBe(estimatedCostUsd);
        }
      });
    });

    describe('Gemini Standard Rates ($0.15 / $0.60 per 1M tokens)', () => {
      it('5.5: Zero tokens cost 0 USD', () => {
        expect(calculateGeminiCost(0, 0, GEMINI_STANDARD_RATES)).toBe(0);
      });

      it('5.6: 1M prompt tokens cost $0.15', () => {
        const cost = calculateGeminiCost(1_000_000, 0, GEMINI_STANDARD_RATES);
        expect(cost).toBe(0.15);
      });

      it('5.7: 1M completion tokens cost $0.60', () => {
        const cost = calculateGeminiCost(0, 1_000_000, GEMINI_STANDARD_RATES);
        expect(cost).toBe(0.6);
      });

      it('5.8: 1M prompt + 1M completion tokens cost $0.75', () => {
        const cost = calculateGeminiCost(1_000_000, 1_000_000, GEMINI_STANDARD_RATES);
        expect(cost).toBe(0.75);
      });

      it('5.9: Arbitrary token numbers calculate with correct precision', () => {
        // 50,000 prompt * $0.15 / 1M = 0.0075
        // 25,000 completion * $0.60 / 1M = 0.0150
        // Total = 0.0225 USD
        const cost = calculateGeminiCost(50_000, 25_000, GEMINI_STANDARD_RATES);
        expect(cost).toBe(0.0225);
      });
    });

    describe('estimateTokenCount Heuristics', () => {
      it('5.10: Handles null, undefined, empty, and whitespace strings returning 0', () => {
        expect(estimateTokenCount(null as any)).toBe(0);
        expect(estimateTokenCount(undefined as any)).toBe(0);
        expect(estimateTokenCount('')).toBe(0);
        expect(estimateTokenCount('    ')).toBe(0);
      });

      it('5.11: Returns monotonically increasing counts for longer English sentences', () => {
        const short = 'Do this task.';
        const med = 'Do this task by tomorrow morning and assign to Sarah.';
        const long =
          'Do this task by tomorrow morning and assign to Sarah. Also configure the PostgreSQL database and deploy the endpoints.';

        const tShort = estimateTokenCount(short);
        const tMed = estimateTokenCount(med);
        const tLong = estimateTokenCount(long);

        expect(tShort).toBeGreaterThanOrEqual(1);
        expect(tMed).toBeGreaterThan(tShort);
        expect(tLong).toBeGreaterThan(tMed);
      });

      it('5.12: Correctly estimates Hindi Devanagari and Hinglish token counts', () => {
        const hindi = 'हफ्ते के अंत तक हमें डेटाबेस माइग्रेशन पूरा करना है';
        const hinglish = 'Kal subah 10 baje sprint planning meeting karni hai';

        expect(estimateTokenCount(hindi)).toBeGreaterThan(10);
        expect(estimateTokenCount(hinglish)).toBeGreaterThan(10);
      });
    });
  });
});
