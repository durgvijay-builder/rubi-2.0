import { describe, it, expect, vi } from 'vitest';
import {
  MockGeminiExtractionAdapter,
  LiveGeminiExtractionAdapter,
  GeminiExtractionAdapter,
  estimateTokenCount,
  calculateGeminiCost,
  GEMINI_FLASH_RATES,
  GEMINI_STANDARD_RATES,
  EXTRACTION_FIXTURES,
} from '../src/extraction/index.js';

describe('Gemini Extraction Adapters & Token Pricing', () => {
  describe('Token Pricing & Estimation', () => {
    it('estimates tokens using word and character heuristics', () => {
      expect(estimateTokenCount('')).toBe(0);
      expect(estimateTokenCount('   ')).toBe(0);
      expect(estimateTokenCount('Hello')).toBeGreaterThanOrEqual(1);
      const sentence = 'Kal subah 10 baje sprint planning meeting karni hai';
      expect(estimateTokenCount(sentence)).toBeGreaterThan(8);
    });

    it('calculates costs according to Gemini Flash rates matching test fixtures', () => {
      // HINGLISH_SPRINT_MEETING: 380 prompt, 210 completion -> 0.0000915 USD
      const cost = calculateGeminiCost(380, 210, GEMINI_FLASH_RATES);
      expect(cost).toBe(0.0000915);
    });

    it('calculates costs according to Gemini Standard rates', () => {
      // 1,000,000 prompt + 1,000,000 completion -> 0.15 + 0.60 = 0.75 USD
      const cost = calculateGeminiCost(1_000_000, 1_000_000, GEMINI_STANDARD_RATES);
      expect(cost).toBe(0.75);
    });
  });

  describe('MockGeminiExtractionAdapter', () => {
    const adapter = new MockGeminiExtractionAdapter();

    it('returns empty batch with 0 tokens for empty or whitespace transcript', async () => {
      const result = await adapter.extractActions('');
      expect(result.tasks).toEqual([]);
      expect(result.tokensUsed.totalTokens).toBe(0);
      expect(result.tokensUsed.estimatedCostUsd).toBe(0);
    });

    it('matches Hinglish sprint planning fixture with 3 tasks and dependency', async () => {
      const fixture = EXTRACTION_FIXTURES.HINGLISH_SPRINT_MEETING;
      const result = await adapter.extractActions(fixture.transcript);

      expect(result.tasks.length).toBe(3);
      expect(result.tasks[0]?.title).toMatch(/architecture document/i);
      expect(result.tasks[0]?.owner).toBe('Durgvijay');
      expect(result.tasks[2]?.dependencies).toContain('task-temp-1');
      expect(result.tokensUsed.totalTokens).toBe(590);
      expect(result.tokensUsed.estimatedCostUsd).toBe(0.0000915);
    });

    it('matches English database pipeline fixture with blocking dependency', async () => {
      const fixture = EXTRACTION_FIXTURES.EN_DATABASE_PIPELINE;
      const result = await adapter.extractActions(fixture.transcript);

      expect(result.tasks.length).toBe(2);
      expect(result.tasks[0]?.title).toMatch(/postgresql database/i);
      expect(result.tasks[1]?.dependencies).toContain('task-temp-db');
    });

    it('matches English single task retrospective fixture', async () => {
      const fixture = EXTRACTION_FIXTURES.EN_SINGLE_TASK;
      const result = await adapter.extractActions(fixture.transcript);

      expect(result.tasks.length).toBe(1);
      expect(result.tasks[0]?.owner).toBe('Sarah');
      expect(result.tasks[0]?.deadline).toBe('2026-11-13T16:00:00.000Z');
    });

    it('matches Hindi task creation fixture', async () => {
      const fixture = EXTRACTION_FIXTURES.HI_TASK_CREATION;
      const result = await adapter.extractActions(fixture.transcript);

      expect(result.tasks.length).toBe(1);
      expect(result.tasks[0]?.owner).toBe('राहुल');
    });

    it('matches ambiguous task fixture with null owner and item ambiguities', async () => {
      const fixture = EXTRACTION_FIXTURES.EN_AMBIGUOUS_NO_OWNER;
      const result = await adapter.extractActions(fixture.transcript);

      expect(result.tasks.length).toBe(1);
      expect(result.tasks[0]?.owner).toBeNull();
      expect(result.tasks[0]?.ambiguities.length).toBeGreaterThan(0);
      expect(result.ambiguities.length).toBeGreaterThan(0);
    });

    it('matches circular dependency loop fixture', async () => {
      const fixture = EXTRACTION_FIXTURES.CIRCULAR_DEPENDENCY_CYCLE;
      const result = await adapter.extractActions(fixture.transcript);

      expect(result.tasks.length).toBe(2);
      expect(result.hasCycle).toBe(true);
      expect(result.tasks[0]?.cycleError).toBe(true);
      expect(result.tasks[1]?.cycleError).toBe(true);
    });

    it('matches self-dependency fixture', async () => {
      const fixture = EXTRACTION_FIXTURES.SELF_DEPENDENCY_CASE;
      const result = await adapter.extractActions(fixture.transcript);

      expect(result.tasks.length).toBe(1);
      expect(result.tasks[0]?.title).toBe('Task Gamma');
      expect(result.ambiguities.length).toBeGreaterThan(0);
    });

    it('dynamically synthesizes schema-valid batch for arbitrary transcripts', async () => {
      const arbitrary =
        'Please build the caching layer using Redis by next week and assign to Alex. Urgent security audit is also needed.';
      const result = await adapter.extractActions(arbitrary);

      expect(result.tasks.length).toBeGreaterThanOrEqual(1);
      expect(result.tasks[0]?.tempId).toBeDefined();
      expect(result.tasks[0]?.title).toBeDefined();
      expect(result.tokensUsed.totalTokens).toBeGreaterThan(0);
      expect(result.tokensUsed.estimatedCostUsd).toBeGreaterThan(0);
    });
  });

  describe('LiveGeminiExtractionAdapter', () => {
    it('throws error if apiKey is missing', async () => {
      const adapter = new LiveGeminiExtractionAdapter({ apiKey: '' });
      await expect(adapter.extractActions('some transcript')).rejects.toThrow(
        /GEMINI_API_KEY is required/i
      );
    });

    it('returns empty batch for empty transcript without network call', async () => {
      const fetchMock = vi.fn();
      const adapter = new LiveGeminiExtractionAdapter({
        apiKey: 'test-key',
        fetchFn: fetchMock as any,
      });

      const result = await adapter.extractActions('');
      expect(result.tasks).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('successfully calls Gemini REST endpoint and parses candidate JSON response', async () => {
      const fakeGeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    summary: 'Extracted 1 live task',
                    tasks: [
                      {
                        tempId: 'task-temp-live-1',
                        title: 'Deploy to Cloudflare Workers',
                        description: 'Production deployment',
                        owner: 'Durgvijay',
                        priority: 'HIGH',
                        deadline: '2026-11-20T18:00:00.000Z',
                        dependencies: [],
                        status: 'PENDING_APPROVAL',
                        ambiguities: [],
                      },
                    ],
                    ambiguities: [],
                  }),
                },
              ],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 150,
          candidatesTokenCount: 60,
          totalTokenCount: 210,
        },
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => fakeGeminiResponse,
      });

      const adapter = new LiveGeminiExtractionAdapter({
        apiKey: 'test-api-key',
        fetchFn: fetchMock as any,
      });

      const result = await adapter.extractActions('Deploy to Cloudflare Workers');
      expect(result.tasks.length).toBe(1);
      expect(result.tasks[0]?.title).toBe('Deploy to Cloudflare Workers');
      expect(result.tokensUsed.totalTokens).toBe(210);
      expect(result.tokensUsed.estimatedCostUsd).toBeGreaterThan(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('throws error when Gemini API returns HTTP error', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => 'Quota exceeded or invalid API key',
      });

      const adapter = new LiveGeminiExtractionAdapter({
        apiKey: 'bad-key',
        fetchFn: fetchMock as any,
      });

      await expect(adapter.extractActions('Do something')).rejects.toThrow(
        /Gemini API extraction failed with status 403/i
      );
    });

    it('throws error when candidate JSON is malformed', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: '<<<NOT_JSON>>>' }],
              },
            },
          ],
        }),
      });

      const adapter = new LiveGeminiExtractionAdapter({
        apiKey: 'test-key',
        fetchFn: fetchMock as any,
      });

      await expect(adapter.extractActions('Do something')).rejects.toThrow(
        /Failed to parse Gemini JSON output/i
      );
    });
  });

  describe('GeminiExtractionAdapter Factory', () => {
    it('operates in offline mock mode by default without GEMINI_API_KEY', async () => {
      const factory = new GeminiExtractionAdapter({ mode: 'offline' });
      expect(factory.isLive).toBe(false);

      const result = await factory.extractActions(
        EXTRACTION_FIXTURES.HINGLISH_SPRINT_MEETING.transcript
      );
      expect(result.tasks.length).toBe(3);
    });

    it('falls back to mock adapter when live extraction fails with error', async () => {
      const failingLiveAdapter = {
        extractActions: vi.fn().mockRejectedValue(new Error('Network error or rate limit 429')),
      };

      const factory = new GeminiExtractionAdapter({
        mode: 'live',
        apiKey: 'fake-key',
        liveAdapter: failingLiveAdapter as any,
        fallbackToMockOnError: true,
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await factory.extractActions(
        EXTRACTION_FIXTURES.HINGLISH_SPRINT_MEETING.transcript
      );

      expect(failingLiveAdapter.extractActions).toHaveBeenCalledTimes(1);
      expect(result.tasks.length).toBe(3);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[GeminiExtractionAdapter] Live extraction failed')
      );

      warnSpy.mockRestore();
    });

    it('re-throws error if fallbackToMockOnError is disabled', async () => {
      const failingLiveAdapter = {
        extractActions: vi.fn().mockRejectedValue(new Error('Fatal connection refused')),
      };

      const factory = new GeminiExtractionAdapter({
        mode: 'live',
        apiKey: 'fake-key',
        liveAdapter: failingLiveAdapter as any,
        fallbackToMockOnError: false,
      });

      await expect(factory.extractActions('Test')).rejects.toThrow(/Fatal connection refused/);
    });
  });
});
