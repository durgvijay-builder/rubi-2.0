import { describe, it, expect } from 'vitest';
import { detectCycle } from '../src/contracts/dag.js';

describe('DAG Cycle Detection (Kahn\'s Algorithm)', () => {
  it('returns sortedOrder for a valid linear dependency chain (A -> B -> C)', () => {
    // Task C depends on B; Task B depends on A; Task A has no dependencies
    const tasks = [
      { tempId: 'task-c', dependencies: ['task-b'] },
      { tempId: 'task-a', dependencies: [] },
      { tempId: 'task-b', dependencies: ['task-a'] },
    ];

    const result = detectCycle(tasks);
    expect(result.hasCycle).toBe(false);
    expect(result.sortedOrder).toEqual(['task-a', 'task-b', 'task-c']);
    expect(result.cycleNodes).toBeUndefined();
  });

  it('detects a simple 2-node cycle (A -> B -> A)', () => {
    const tasks = [
      { tempId: 'task-a', dependencies: ['task-b'] },
      { tempId: 'task-b', dependencies: ['task-a'] },
    ];

    const result = detectCycle(tasks);
    expect(result.hasCycle).toBe(true);
    expect(result.cycleNodes).toBeDefined();
    expect(result.cycleNodes).toContain('task-a');
    expect(result.cycleNodes).toContain('task-b');
    expect(result.sortedOrder).toBeUndefined();
  });

  it('detects a 3-node cycle (A -> B -> C -> A)', () => {
    const tasks = [
      { tempId: 'task-a', dependencies: ['task-c'] },
      { tempId: 'task-b', dependencies: ['task-a'] },
      { tempId: 'task-c', dependencies: ['task-b'] },
    ];

    const result = detectCycle(tasks);
    expect(result.hasCycle).toBe(true);
    expect(result.cycleNodes?.length).toBe(3);
    expect(result.cycleNodes).toEqual(expect.arrayContaining(['task-a', 'task-b', 'task-c']));
  });

  it('detects a self-dependency loop (A -> A)', () => {
    const tasks = [
      { tempId: 'task-a', dependencies: ['task-a'] },
      { tempId: 'task-b', dependencies: [] },
    ];

    const result = detectCycle(tasks);
    expect(result.hasCycle).toBe(true);
    expect(result.cycleNodes).toContain('task-a');
  });

  it('resolves a diamond DAG without cycles', () => {
    // A -> B -> D
    // A -> C -> D
    const tasks = [
      { tempId: 'task-d', dependencies: ['task-b', 'task-c'] },
      { tempId: 'task-c', dependencies: ['task-a'] },
      { tempId: 'task-b', dependencies: ['task-a'] },
      { tempId: 'task-a', dependencies: [] },
    ];

    const result = detectCycle(tasks);
    expect(result.hasCycle).toBe(false);
    expect(result.sortedOrder).toBeDefined();
    // A must be first, D must be last
    expect(result.sortedOrder![0]).toBe('task-a');
    expect(result.sortedOrder![3]).toBe('task-d');
  });

  it('handles empty task lists gracefully', () => {
    const result = detectCycle([]);
    expect(result.hasCycle).toBe(false);
    expect(result.sortedOrder).toEqual([]);
  });

  it('ignores external dependencies that exist outside the current extraction batch', () => {
    const tasks = [
      { tempId: 'task-new-1', dependencies: ['pre-existing-db-task-id'] },
      { tempId: 'task-new-2', dependencies: ['task-new-1'] },
    ];

    const result = detectCycle(tasks);
    expect(result.hasCycle).toBe(false);
    expect(result.sortedOrder).toEqual(['task-new-1', 'task-new-2']);
  });
});
