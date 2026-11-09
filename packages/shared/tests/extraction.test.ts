import { describe, it, expect } from 'vitest';
import {
  ExtractedActionItemSchema,
  ExtractedActionBatchSchema,
} from '../src/contracts/extraction.js';

describe('Zod Extraction Schemas', () => {
  it('validates a complete extracted action item', () => {
    const raw = {
      tempId: 'temp-1',
      title: 'Setup PostgreSQL Prisma Schema',
      description: 'Define relational models for multi-tenant workspace and tasks',
      owner: 'Durgvijay Chauhan',
      priority: 'HIGH',
      deadline: '2026-11-10T18:00:00.000Z',
      dependencies: [],
      status: 'PENDING_APPROVAL',
    };

    const parsed = ExtractedActionItemSchema.parse(raw);
    expect(parsed.tempId).toBe('temp-1');
    expect(parsed.title).toBe('Setup PostgreSQL Prisma Schema');
    expect(parsed.priority).toBe('HIGH');
    expect(parsed.status).toBe('PENDING_APPROVAL');
  });

  it('applies default values for optional fields', () => {
    const minimal = {
      tempId: 'temp-2',
      title: 'Run lint verification',
    };

    const parsed = ExtractedActionItemSchema.parse(minimal);
    expect(parsed.owner).toBeNull();
    expect(parsed.priority).toBe('MEDIUM');
    expect(parsed.deadline).toBeNull();
    expect(parsed.dependencies).toEqual([]);
    expect(parsed.status).toBe('PENDING_APPROVAL');
    expect(parsed.ambiguities).toEqual([]);
  });

  it('supports TODO status enum per PROJECT.md specifications', () => {
    const withTodo = {
      tempId: 'temp-3',
      title: 'Implement voice recording',
      status: 'TODO',
    };

    const parsed = ExtractedActionItemSchema.parse(withTodo);
    expect(parsed.status).toBe('TODO');
  });

  it('normalizes TO_DO status to TODO', () => {
    const withSnakeTodo = {
      tempId: 'temp-snake',
      title: 'Handle snake case',
      status: 'TO_DO',
    };

    const parsed = ExtractedActionItemSchema.parse(withSnakeTodo);
    expect(parsed.status).toBe('TODO');
  });

  it('supports assignee as alias for owner', () => {
    const withAssignee = {
      tempId: 'temp-assignee',
      title: 'Assignee Alias Test',
      assignee: 'Alice Engineer',
    };

    const parsed = ExtractedActionItemSchema.parse(withAssignee);
    expect(parsed.owner).toBe('Alice Engineer');
    expect(parsed.assignee).toBe('Alice Engineer');
  });

  it('supports targetDate as alias for deadline', () => {
    const withTargetDate = {
      tempId: 'temp-date',
      title: 'Target Date Alias Test',
      targetDate: '2026-11-15T18:00:00.000Z',
    };

    const parsed = ExtractedActionItemSchema.parse(withTargetDate);
    expect(parsed.deadline).toBe('2026-11-15T18:00:00.000Z');
    expect(parsed.targetDate).toBe('2026-11-15T18:00:00.000Z');
  });

  it('supports item-level ambiguities array', () => {
    const withAmbiguities = {
      tempId: 'temp-ambig',
      title: 'Fix issue',
      ambiguities: ['Assignee was not specified', 'Deadline is relative or missing'],
    };

    const parsed = ExtractedActionItemSchema.parse(withAmbiguities);
    expect(parsed.ambiguities.length).toBe(2);
    expect(parsed.ambiguities[0]).toBe('Assignee was not specified');
  });

  it('rejects an action item without a title', () => {
    const invalid = {
      tempId: 'temp-4',
      title: '',
    };

    expect(() => ExtractedActionItemSchema.parse(invalid)).toThrow();
  });

  it('validates a full action batch with token usage telemetry', () => {
    const batchRaw = {
      summary: 'Voice transcript with 2 extracted tasks',
      tasks: [
        {
          tempId: 'task-1',
          title: 'Transcribe audio',
          priority: 'HIGH',
        },
        {
          tempId: 'task-2',
          title: 'Synthesize confirmation audio',
          dependencies: ['task-1'],
        },
      ],
      ambiguities: ['Unclear whether meeting is online or offline'],
      tokensUsed: {
        promptTokens: 250,
        completionTokens: 110,
        totalTokens: 360,
        estimatedCostUsd: 0.00035,
      },
    };

    const batch = ExtractedActionBatchSchema.parse(batchRaw);
    expect(batch.summary).toBe('Voice transcript with 2 extracted tasks');
    expect(batch.tasks.length).toBe(2);
    expect(batch.ambiguities.length).toBe(1);
    expect(batch.tokensUsed.totalTokens).toBe(360);
    expect(batch.tokensUsed.estimatedCostUsd).toBe(0.00035);
  });
});
