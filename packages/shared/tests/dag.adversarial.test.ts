import { describe, it, expect } from 'vitest';
import { detectCycle } from '../src/contracts/dag.js';

describe('Adversarial DAG Cycle Detection Test Suite', () => {
  // ── 1. Linear Chains ───────────────────────────────────────────────────────
  describe('Linear Dependency Chains', () => {
    it('verifies linear chain: A -> B -> C (must return hasCycle: false and sortedOrder: [A, B, C])', () => {
      // In Kahn's algorithm, dependency means prerequisite: Task B depends on A, Task C depends on B
      const tasks = [
        { tempId: 'task-c', dependencies: ['task-b'] },
        { tempId: 'task-b', dependencies: ['task-a'] },
        { tempId: 'task-a', dependencies: [] },
      ];

      const result = detectCycle(tasks);
      expect(result.hasCycle).toBe(false);
      expect(result.sortedOrder).toEqual(['task-a', 'task-b', 'task-c']);
      expect(result.cycleNodes).toBeUndefined();
    });

    it('verifies deep linear chain of 100 consecutive dependencies', () => {
      const taskCount = 100;
      const tasks: Array<{ tempId: string; dependencies: string[] }> = [];

      for (let i = 0; i < taskCount; i++) {
        tasks.push({
          tempId: `node-${i}`,
          dependencies: i === 0 ? [] : [`node-${i - 1}`],
        });
      }

      // Shuffle array to ensure Kahn's algorithm is independent of array input order
      const shuffled = [...tasks].sort(() => Math.random() - 0.5);

      const result = detectCycle(shuffled);
      expect(result.hasCycle).toBe(false);
      expect(result.sortedOrder).toBeDefined();
      expect(result.sortedOrder?.length).toBe(taskCount);

      // Verify that every node appears strictly after its dependency in sortedOrder
      const positionMap = new Map<string, number>();
      result.sortedOrder!.forEach((id, idx) => positionMap.set(id, idx));

      for (let i = 1; i < taskCount; i++) {
        const prevPos = positionMap.get(`node-${i - 1}`)!;
        const currPos = positionMap.get(`node-${i}`)!;
        expect(prevPos).toBeLessThan(currPos);
      }
    });
  });

  // ── 2. Simple Cycles ───────────────────────────────────────────────────────
  describe('Simple Cycles', () => {
    it('verifies simple 2-node cycle: A -> B -> A (must return hasCycle: true and cycleNodes: [A, B])', () => {
      const tasks = [
        { tempId: 'node-a', dependencies: ['node-b'] },
        { tempId: 'node-b', dependencies: ['node-a'] },
      ];

      const result = detectCycle(tasks);
      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodes).toBeDefined();
      expect(result.cycleNodes).toHaveLength(2);
      expect(result.cycleNodes).toEqual(expect.arrayContaining(['node-a', 'node-b']));
      expect(result.sortedOrder).toBeUndefined();
    });

    it('verifies 3-node cycle: A -> B -> C -> A', () => {
      const tasks = [
        { tempId: 'node-a', dependencies: ['node-c'] },
        { tempId: 'node-b', dependencies: ['node-a'] },
        { tempId: 'node-c', dependencies: ['node-b'] },
      ];

      const result = detectCycle(tasks);
      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodes).toBeDefined();
      expect(result.cycleNodes).toHaveLength(3);
      expect(result.cycleNodes).toEqual(expect.arrayContaining(['node-a', 'node-b', 'node-c']));
    });
  });

  // ── 3. Self-Loops ──────────────────────────────────────────────────────────
  describe('Self-Loops', () => {
    it('verifies isolated self-loop: A -> A (must return hasCycle: true and cycleNodes: [A])', () => {
      const tasks = [
        { tempId: 'node-a', dependencies: ['node-a'] },
      ];

      const result = detectCycle(tasks);
      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodes).toEqual(['node-a']);
      expect(result.sortedOrder).toBeUndefined();
    });

    it('verifies self-loop coexisting with an independent valid acyclic chain', () => {
      // Node A is cyclic (self-loop). Independent chain: X -> Y -> Z is acyclic.
      const tasks = [
        { tempId: 'node-a', dependencies: ['node-a'] },
        { tempId: 'node-x', dependencies: [] },
        { tempId: 'node-y', dependencies: ['node-x'] },
        { tempId: 'node-z', dependencies: ['node-y'] },
      ];

      const result = detectCycle(tasks);
      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodes).toBeDefined();
      // Only node-a is cyclic; node-x, node-y, node-z were resolved with zero in-degree
      expect(result.cycleNodes).toEqual(['node-a']);
    });
  });

  // ── 4. Complex Diamond DAG with Cycle ──────────────────────────────────────
  describe('Complex Diamond DAG with Cycle', () => {
    it('verifies diamond DAG with cycle: A -> B -> C -> D, D -> B (must return hasCycle: true)', () => {
      // A is root (no dependencies)
      // B depends on A and D
      // C depends on B
      // D depends on C
      // This forms a cycle B -> C -> D -> B, while A points into B
      const tasks = [
        { tempId: 'node-a', dependencies: [] },
        { tempId: 'node-b', dependencies: ['node-a', 'node-d'] },
        { tempId: 'node-c', dependencies: ['node-b'] },
        { tempId: 'node-d', dependencies: ['node-c'] },
      ];

      const result = detectCycle(tasks);
      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodes).toBeDefined();
      // node-a has in-degree 0 and is processed, leaving node-b, node-c, node-d blocked
      expect(result.cycleNodes).toEqual(expect.arrayContaining(['node-b', 'node-c', 'node-d']));
      expect(result.cycleNodes).not.toContain('node-a');
    });

    it('verifies diamond DAG with cycle looping back to root: A -> B -> D, A -> C -> D, D -> A', () => {
      // Entire diamond forms a cycle back to root A
      const tasks = [
        { tempId: 'node-a', dependencies: ['node-d'] },
        { tempId: 'node-b', dependencies: ['node-a'] },
        { tempId: 'node-c', dependencies: ['node-a'] },
        { tempId: 'node-d', dependencies: ['node-b', 'node-c'] },
      ];

      const result = detectCycle(tasks);
      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodes).toBeDefined();
      expect(result.cycleNodes).toHaveLength(4);
      expect(result.cycleNodes).toEqual(expect.arrayContaining(['node-a', 'node-b', 'node-c', 'node-d']));
    });

    it('verifies diamond DAG with cross-edge cycle: B <-> C within A -> (B, C) -> D', () => {
      // A -> B and A -> C
      // B -> C and C -> B (cycle between B and C)
      // Both B and C -> D
      const tasks = [
        { tempId: 'node-a', dependencies: [] },
        { tempId: 'node-b', dependencies: ['node-a', 'node-c'] },
        { tempId: 'node-c', dependencies: ['node-a', 'node-b'] },
        { tempId: 'node-d', dependencies: ['node-b', 'node-c'] },
      ];

      const result = detectCycle(tasks);
      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodes).toBeDefined();
      // A is processed; B, C, D have remaining in-degree (D is blocked by cyclic B & C)
      expect(result.cycleNodes).toEqual(expect.arrayContaining(['node-b', 'node-c', 'node-d']));
      expect(result.cycleNodes).not.toContain('node-a');
    });
  });

  // ── 5. Disconnected Components ─────────────────────────────────────────────
  describe('Disconnected Components', () => {
    it('verifies multiple disconnected acyclic components resolve successfully', () => {
      // Component 1: A -> B
      // Component 2: C -> D -> E
      // Component 3: F (isolated node)
      const tasks = [
        { tempId: 'node-b', dependencies: ['node-a'] },
        { tempId: 'node-a', dependencies: [] },
        { tempId: 'node-e', dependencies: ['node-d'] },
        { tempId: 'node-d', dependencies: ['node-c'] },
        { tempId: 'node-c', dependencies: [] },
        { tempId: 'node-f', dependencies: [] },
      ];

      const result = detectCycle(tasks);
      expect(result.hasCycle).toBe(false);
      expect(result.sortedOrder).toBeDefined();
      expect(result.sortedOrder).toHaveLength(6);

      const pos = new Map<string, number>();
      result.sortedOrder!.forEach((id, idx) => pos.set(id, idx));

      // Check Component 1 ordering: A before B
      expect(pos.get('node-a')!).toBeLessThan(pos.get('node-b')!);
      // Check Component 2 ordering: C before D, D before E
      expect(pos.get('node-c')!).toBeLessThan(pos.get('node-d')!);
      expect(pos.get('node-d')!).toBeLessThan(pos.get('node-e')!);
      // Isolated node F must be present
      expect(pos.has('node-f')).toBe(true);
    });

    it('verifies disconnected components where one component has a cycle and others are valid', () => {
      // Component 1 (valid): A -> B
      // Component 2 (cyclic): X -> Y -> X
      // Component 3 (valid isolated): Z
      const tasks = [
        { tempId: 'node-a', dependencies: [] },
        { tempId: 'node-b', dependencies: ['node-a'] },
        { tempId: 'node-x', dependencies: ['node-y'] },
        { tempId: 'node-y', dependencies: ['node-x'] },
        { tempId: 'node-z', dependencies: [] },
      ];

      const result = detectCycle(tasks);
      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodes).toBeDefined();
      // Only X and Y should be reported as cycle nodes; A, B, and Z are acyclic
      expect(result.cycleNodes).toEqual(expect.arrayContaining(['node-x', 'node-y']));
      expect(result.cycleNodes).not.toContain('node-a');
      expect(result.cycleNodes).not.toContain('node-b');
      expect(result.cycleNodes).not.toContain('node-z');
    });
  });

  // ── 6. Adversarial Edge Cases & Boundary Conditions ─────────────────────────
  describe('Adversarial Edge Cases & Boundaries', () => {
    it('handles empty input list', () => {
      const result = detectCycle([]);
      expect(result.hasCycle).toBe(false);
      expect(result.sortedOrder).toEqual([]);
      expect(result.cycleNodes).toBeUndefined();
    });

    it('handles single isolated task with no dependencies', () => {
      const result = detectCycle([{ tempId: 'solo-task', dependencies: [] }]);
      expect(result.hasCycle).toBe(false);
      expect(result.sortedOrder).toEqual(['solo-task']);
    });

    it('handles duplicate dependencies gracefully (deduplication)', () => {
      // Task B lists dependency on A three times
      const tasks = [
        { tempId: 'task-a', dependencies: [] },
        { tempId: 'task-b', dependencies: ['task-a', 'task-a', 'task-a'] },
      ];

      const result = detectCycle(tasks);
      expect(result.hasCycle).toBe(false);
      expect(result.sortedOrder).toEqual(['task-a', 'task-b']);
    });

    it('handles external dependencies referencing tasks outside the current batch', () => {
      const tasks = [
        { tempId: 'batch-task-1', dependencies: ['ext-task-999', 'ext-task-888'] },
        { tempId: 'batch-task-2', dependencies: ['batch-task-1'] },
      ];

      const result = detectCycle(tasks);
      expect(result.hasCycle).toBe(false);
      expect(result.sortedOrder).toEqual(['batch-task-1', 'batch-task-2']);
    });

    it('handles fan-in star topology: 50 independent tasks all prerequisite to one final task', () => {
      const tasks: Array<{ tempId: string; dependencies: string[] }> = [];
      const leafIds: string[] = [];

      for (let i = 0; i < 50; i++) {
        const id = `leaf-${i}`;
        leafIds.push(id);
        tasks.push({ tempId: id, dependencies: [] });
      }

      tasks.push({ tempId: 'collector-node', dependencies: leafIds });

      const result = detectCycle(tasks);
      expect(result.hasCycle).toBe(false);
      expect(result.sortedOrder).toHaveLength(51);
      // Collector must be the very last task executed
      expect(result.sortedOrder![50]).toBe('collector-node');
    });

    it('handles fan-out star topology: 1 root task prerequisite to 50 independent tasks', () => {
      const tasks: Array<{ tempId: string; dependencies: string[] }> = [
        { tempId: 'root-emitter', dependencies: [] },
      ];

      for (let i = 0; i < 50; i++) {
        tasks.push({ tempId: `leaf-${i}`, dependencies: ['root-emitter'] });
      }

      const result = detectCycle(tasks);
      expect(result.hasCycle).toBe(false);
      expect(result.sortedOrder).toHaveLength(51);
      // Root emitter must be the very first task executed
      expect(result.sortedOrder![0]).toBe('root-emitter');
    });

    it('detects cycle in a dense complete directed graph (K4 clique with directed edges)', () => {
      // 4 nodes where every node i depends on node (i + 1) % 4
      const tasks = [
        { tempId: 'k-0', dependencies: ['k-1'] },
        { tempId: 'k-1', dependencies: ['k-2'] },
        { tempId: 'k-2', dependencies: ['k-3'] },
        { tempId: 'k-3', dependencies: ['k-0'] },
      ];

      const result = detectCycle(tasks);
      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodes).toHaveLength(4);
      expect(result.cycleNodes).toEqual(expect.arrayContaining(['k-0', 'k-1', 'k-2', 'k-3']));
    });

    it('detects figure-8 dual cycles: (A <-> B) and (C <-> D)', () => {
      const tasks = [
        { tempId: 'fig-a', dependencies: ['fig-b'] },
        { tempId: 'fig-b', dependencies: ['fig-a'] },
        { tempId: 'fig-c', dependencies: ['fig-d'] },
        { tempId: 'fig-d', dependencies: ['fig-c'] },
      ];

      const result = detectCycle(tasks);
      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodes).toHaveLength(4);
      expect(result.cycleNodes).toEqual(expect.arrayContaining(['fig-a', 'fig-b', 'fig-c', 'fig-d']));
    });
  });
});
