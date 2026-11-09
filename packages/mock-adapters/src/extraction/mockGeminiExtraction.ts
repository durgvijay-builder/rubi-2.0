import {
  type IExtractionAdapter,
  type ExtractedActionBatch,
  ExtractedActionBatchSchema,
} from '@rubi/shared';
import { EXTRACTION_FIXTURES } from './fixtures.js';
import { estimateTokenCount, calculateGeminiCost } from './tokenPricing.js';

/**
 * Deterministic offline mock implementation of Gemini Structured Action Extraction.
 *
 * Implements IExtractionAdapter. Provides genuine multi-task extraction,
 * dependency tracking, ambiguity detection, and cycle simulation across
 * English, Hindi, and Hinglish. Supports arbitrary transcripts via schema-valid
 * dynamic fallback.
 */
export class MockGeminiExtractionAdapter implements IExtractionAdapter {
  async extractActions(
    transcript: string,
    _context?: Record<string, unknown>
  ): Promise<ExtractedActionBatch> {
    if (!transcript || transcript.trim() === '') {
      return ExtractedActionBatchSchema.parse({
        summary: 'Empty transcript received; no actionable tasks identified.',
        tasks: [],
        ambiguities: [],
        tokensUsed: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          estimatedCostUsd: 0,
        },
      });
    }

    const clean = transcript.trim();
    const lower = clean.toLowerCase();

    // 1. Multi-Task Sprint Planning (Hinglish)
    if (
      lower.includes('architecture document') ||
      (lower.includes('sprint planning') && lower.includes('durgvijay'))
    ) {
      return this.cloneBatch(EXTRACTION_FIXTURES.HINGLISH_SPRINT_MEETING.batch);
    }

    // 2. Database Pipeline (English)
    if (
      (lower.includes('postgresql') || lower.includes('database')) &&
      lower.includes('api integration')
    ) {
      return this.cloneBatch(EXTRACTION_FIXTURES.EN_DATABASE_PIPELINE.batch);
    }

    // 3. Single Task Retrospective (English)
    if (lower.includes('retrospective') || (lower.includes('sarah') && lower.includes('friday'))) {
      return this.cloneBatch(EXTRACTION_FIXTURES.EN_SINGLE_TASK.batch);
    }

    // 4. Hindi Task Creation
    if (clean.includes('डेटाबेस माइग्रेशन') || clean.includes('राहुल')) {
      return this.cloneBatch(EXTRACTION_FIXTURES.HI_TASK_CREATION.batch);
    }

    // 5. English Ambiguous No Assignee
    if (
      lower.includes('critical production bug') ||
      (lower.includes('as soon as possible') && lower.includes('release'))
    ) {
      return this.cloneBatch(EXTRACTION_FIXTURES.EN_AMBIGUOUS_NO_OWNER.batch);
    }

    // 6. Circular Dependency Loop (Alpha <-> Beta)
    if (
      (lower.includes('task alpha') && lower.includes('task beta')) ||
      lower.includes('circular dependency')
    ) {
      return this.cloneBatch(EXTRACTION_FIXTURES.CIRCULAR_DEPENDENCY_CYCLE.batch);
    }

    // 7. Self-Dependency Loop (Task Gamma)
    if (lower.includes('task gamma') || lower.includes('self-dependency')) {
      return this.cloneBatch(EXTRACTION_FIXTURES.SELF_DEPENDENCY_CASE.batch);
    }

    // 8. Hinglish Ambiguous Vague ("Isko jaldi se")
    if (
      lower.includes('isko jaldi se') ||
      (lower.includes('parson tak') && lower.includes('fix'))
    ) {
      return this.cloneBatch(EXTRACTION_FIXTURES.HINGLISH_AMBIGUOUS_VAGUE.batch);
    }

    // 9. Hindi Ambiguous ("इस समस्या को तुरंत हल करो")
    if (clean.includes('समस्या को तुरंत') || clean.includes('तुरंत हल')) {
      return this.cloneBatch(EXTRACTION_FIXTURES.HI_AMBIGUOUS_TASK.batch);
    }

    // 10. Direct commands (if invoked via extraction adapter)
    if (lower.includes('mark task #3') || lower.includes('mark task 3')) {
      return this.cloneBatch(EXTRACTION_FIXTURES.EN_DIRECT_COMMAND_COMPLETE.batch);
    }
    if (lower.includes('show all pending') || lower.includes('list tasks')) {
      return this.cloneBatch(EXTRACTION_FIXTURES.EN_DIRECT_COMMAND_QUERY.batch);
    }
    if (clean.includes('टास्क नंबर 5')) {
      return this.cloneBatch(EXTRACTION_FIXTURES.HI_DIRECT_COMMAND_COMPLETE.batch);
    }
    if (lower.includes('task #4 ko complete') || lower.includes('task 4 ko complete')) {
      return this.cloneBatch(EXTRACTION_FIXTURES.HINGLISH_DIRECT_COMMAND_DONE.batch);
    }
    if (lower.includes('pending tasks batao')) {
      return this.cloneBatch(EXTRACTION_FIXTURES.HINGLISH_QUERY_TASKS.batch);
    }

    // 11. Arbitrary Transcript Dynamic Synthesis
    return this.synthesizeDynamicBatch(clean);
  }

  /**
   * Generates a fully schema-valid ExtractedActionBatch for arbitrary un-matched transcripts.
   */
  private synthesizeDynamicBatch(transcript: string): ExtractedActionBatch {
    const sentences = transcript
      .split(/(?<=[.!?])\s+|\s+(?:and|aur|also)\s+/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);

    const taskCount = Math.max(1, Math.min(sentences.length, 3));
    const tasks = [];

    for (let i = 0; i < taskCount; i++) {
      const sentence = sentences[i] ?? transcript;
      const tempId = `task-dyn-${i + 1}`;
      const title = sentence.length > 60 ? `${sentence.slice(0, 57)}...` : sentence;

      // Extract owner heuristic
      const ownerMatch = sentence.match(/(?:assign\s+to|owner\s+is|ko)\s+([A-Z][a-z]+)/i);
      const owner = ownerMatch ? ownerMatch[1] : null;

      // Ambiguities check
      const ambiguities: string[] = [];
      if (!owner) {
        ambiguities.push('Assignee was not specified in conversation');
      }

      tasks.push({
        tempId,
        title,
        description: sentence,
        owner,
        priority: /urgent|critical|zaruri|jaldi/i.test(sentence) ? ('HIGH' as const) : ('MEDIUM' as const),
        deadline: null,
        dependencies: i > 0 && /blocked|depends|ke\s+baad/i.test(sentence) ? [`task-dyn-${i}`] : [],
        status: 'PENDING_APPROVAL' as const,
        ambiguities,
      });
    }

    const promptTokens = estimateTokenCount(transcript) + 160;
    const completionTokens = tasks.length * 45 + 50;
    const totalTokens = promptTokens + completionTokens;
    const estimatedCostUsd = calculateGeminiCost(promptTokens, completionTokens);

    return ExtractedActionBatchSchema.parse({
      summary: `Synthesized tasks from conversation: "${transcript.slice(0, 60)}..."`,
      tasks,
      ambiguities: tasks.some((t) => t.ambiguities.length > 0)
        ? ['Some tasks have unspecified assignees or relative deadlines.']
        : [],
      tokensUsed: {
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd,
      },
    });
  }

  private cloneBatch(batch: ExtractedActionBatch): ExtractedActionBatch {
    return ExtractedActionBatchSchema.parse(JSON.parse(JSON.stringify(batch)));
  }
}
