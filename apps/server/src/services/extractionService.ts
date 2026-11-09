import { GeminiExtractionAdapter } from '@rubi/mock-adapters';
import {
  type IExtractionAdapter,
  type ExtractedActionBatch,
  type ExtractedActionItem,
  detectCycle,
  normalizeDeadline,
  ExtractedActionBatchSchema,
} from '@rubi/shared';

export interface ExtractionServiceOptions {
  adapter?: IExtractionAdapter;
}

/**
 * Extraction Service coordinating Gemini structured extraction,
 * self-dependency sanitization, deadline normalization, and Kahn's DAG cycle detection.
 */
export class ExtractionService {
  private readonly adapter: IExtractionAdapter;

  constructor(options?: ExtractionServiceOptions) {
    this.adapter = options?.adapter ?? new GeminiExtractionAdapter();
  }

  /**
   * Extracts structured action items from transcript with validation and sanitization.
   */
  async extractActions(
    transcript: string,
    context?: Record<string, unknown>
  ): Promise<ExtractedActionBatch> {
    // 1. Delegate to underlying extraction adapter (Live or Mock)
    const rawBatch = await this.adapter.extractActions(transcript, context);

    // 2. Clone to avoid in-place mutation of static fixture instances
    const batch: ExtractedActionBatch = JSON.parse(JSON.stringify(rawBatch));

    // 3. Sanitize self-referencing dependencies (TC-BOUND-05)
    for (const task of batch.tasks) {
      if (task.dependencies.includes(task.tempId)) {
        // Strip self-reference
        task.dependencies = task.dependencies.filter((depId) => depId !== task.tempId);

        const itemMsg = 'Self-referencing dependency was automatically removed';
        if (!task.ambiguities.includes(itemMsg)) {
          task.ambiguities.push(itemMsg);
        }

        const batchMsg = `Self-referencing dependency detected on ${task.title} and removed.`;
        if (!batch.ambiguities.includes(batchMsg)) {
          batch.ambiguities.push(batchMsg);
        }
      }

      // 4. Normalize relative deadlines
      if (task.deadline) {
        task.deadline = normalizeDeadline(task.deadline) ?? task.deadline;
      }
    }

    // 5. Kahn's DAG Cycle Detection (TC-BOUND-04)
    const cycleResult = detectCycle(
      batch.tasks.map((t) => ({
        tempId: t.tempId,
        dependencies: t.dependencies,
      }))
    );

    if (cycleResult.hasCycle) {
      batch.hasCycle = true;
      const cycleTempIds = cycleResult.cycleNodes ?? [];

      // Find titles or names of nodes in the cycle
      const cycleTitles: string[] = [];
      for (const t of batch.tasks) {
        if (cycleTempIds.includes(t.tempId)) {
          t.cycleError = true;
          cycleTitles.push(t.title);
        }
      }

      batch.cycleNodes = cycleTitles.length > 0 ? cycleTitles : cycleTempIds;
      const nodesDisplay = batch.cycleNodes.join(' and ');
      batch.cycleError = `Circular dependency detected: ${nodesDisplay} mutually depend on each other.`;

      const ambigMsg = `Circular dependency detected between ${nodesDisplay}.`;
      if (!batch.ambiguities.includes(ambigMsg)) {
        batch.ambiguities.push(ambigMsg);
      }
    } else {
      batch.hasCycle = false;
    }

    return ExtractedActionBatchSchema.parse(batch);
  }
}

// Global default singleton service instance
export const extractionService = new ExtractionService();
