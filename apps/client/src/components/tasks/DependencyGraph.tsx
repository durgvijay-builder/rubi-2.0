import React from 'react';
import { GitBranch, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { TaskItem } from '../../lib/apiClient.js';

interface DependencyGraphProps {
  tasks: TaskItem[];
}

export const DependencyGraph: React.FC<DependencyGraphProps> = ({ tasks }) => {
  const tasksWithDeps = tasks.filter((t) => t.dependencies && t.dependencies.length > 0);

  if (tasksWithDeps.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="dependency-graph"
      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg flex flex-col gap-3"
    >
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <GitBranch className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-slate-200">Task Dependency Topology</h3>
      </div>

      <div className="flex flex-col gap-2.5">
        {tasksWithDeps.map((task) => (
          <div
            key={task.id}
            className="flex flex-wrap items-center gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 text-xs"
          >
            {/* Prerequisites */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {task.dependencies.map((depId) => {
                const prereqTask = tasks.find((t) => t.id === depId);
                const isCompleted = prereqTask?.status === 'COMPLETED';

                return (
                  <span
                    key={depId}
                    className={`px-2 py-1 rounded font-medium inline-flex items-center gap-1 border ${
                      isCompleted
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                        : 'bg-amber-950/60 text-amber-300 border-amber-800'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <ShieldAlert className="w-3 h-3 text-amber-400" />
                    )}
                    {prereqTask ? prereqTask.title : depId}
                  </span>
                );
              })}
            </div>

            <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />

            {/* Blocked task */}
            <span
              className={`px-2 py-1 rounded font-semibold border ${
                task.status === 'BLOCKED'
                  ? 'bg-red-950/80 text-red-300 border-red-800'
                  : 'bg-slate-800 text-slate-200 border-slate-700'
              }`}
            >
              {task.title} ({task.status})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
