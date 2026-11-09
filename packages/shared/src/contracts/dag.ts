export interface CycleCheckResult {
  hasCycle: boolean;
  cycleNodes?: string[];
  sortedOrder?: string[];
}

/**
 * Detects cycles in a collection of task dependencies using Kahn's algorithm.
 * Topological order places prerequisite tasks before the dependent tasks.
 *
 * @param tasks List of tasks with tempId and array of dependency tempIds
 * @returns CycleCheckResult indicating presence of cycle, cycleNodes if cyclical, or sortedOrder if valid DAG
 */
export function detectCycle(
  tasks: Array<{ tempId: string; dependencies: string[] }>
): CycleCheckResult {
  if (tasks.length === 0) {
    return { hasCycle: false, sortedOrder: [] };
  }

  const taskIds = new Set(tasks.map((t) => t.tempId));
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const task of tasks) {
    inDegree.set(task.tempId, 0);
    adj.set(task.tempId, []);
  }

  // Populate graph edges: dependency -> task (prerequisite -> dependent)
  for (const task of tasks) {
    const uniqueDeps = Array.from(new Set(task.dependencies));
    for (const dep of uniqueDeps) {
      if (dep === task.tempId) {
        // Self-dependency forms an immediate cycle
        inDegree.set(task.tempId, (inDegree.get(task.tempId) ?? 0) + 1);
        adj.get(task.tempId)?.push(task.tempId);
      } else if (taskIds.has(dep)) {
        inDegree.set(task.tempId, (inDegree.get(task.tempId) ?? 0) + 1);
        adj.get(dep)?.push(task.tempId);
      }
      // External dependencies (not in current batch) are assumed resolved/external
    }
  }

  // Queue of nodes with zero in-degree (no unresolved prerequisites)
  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
    }
  }

  const sortedOrder: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    sortedOrder.push(current);

    const dependents = adj.get(current) ?? [];
    for (const dep of dependents) {
      const remainingDeg = (inDegree.get(dep) ?? 1) - 1;
      inDegree.set(dep, remainingDeg);
      if (remainingDeg === 0) {
        queue.push(dep);
      }
    }
  }

  if (sortedOrder.length === tasks.length) {
    return {
      hasCycle: false,
      sortedOrder,
    };
  }

  // Nodes with remaining in-degree are involved in or blocked by cycles
  const cycleNodes = tasks
    .filter((t) => (inDegree.get(t.tempId) ?? 0) > 0)
    .map((t) => t.tempId);

  return {
    hasCycle: true,
    cycleNodes,
  };
}
