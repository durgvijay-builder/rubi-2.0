import React from 'react';
import { Check, X, ShieldAlert, GitCommit } from 'lucide-react';
import type { CandidateTask } from '../../lib/apiClient.js';

interface ActionEditorProps {
  task: CandidateTask;
  index: number;
  onUpdate: (tempId: string, updates: Partial<CandidateTask>) => void;
  onApprove: (tempId: string) => void;
  onReject: (tempId: string) => void;
}

export const ActionEditor: React.FC<ActionEditorProps> = ({
  task,
  index,
  onUpdate,
  onApprove,
  onReject,
}) => {
  return (
    <div
      data-testid={`candidate-card-${task.tempId || index}`}
      className="bg-slate-950 border border-slate-800 rounded-lg p-4 shadow flex flex-col gap-3 transition-all hover:border-slate-700"
    >
      {/* Title Input */}
      <div>
        <label
          htmlFor={`title-${task.tempId || index}`}
          className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1 block"
        >
          Task Title
        </label>
        <input
          id={`title-${task.tempId || index}`}
          data-testid="card-title-input"
          name="title"
          type="text"
          value={task.title}
          onChange={(e) => onUpdate(task.tempId, { title: e.target.value })}
          className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
          placeholder="Task title..."
        />
      </div>

      {/* Assignee & Priority Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor={`assignee-${task.tempId || index}`}
            className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1 block"
          >
            Assignee / Owner
          </label>
          <input
            id={`assignee-${task.tempId || index}`}
            data-testid="card-assignee-input"
            name="assignee"
            type="text"
            value={task.owner || task.assignee || ''}
            onChange={(e) =>
              onUpdate(task.tempId, {
                owner: e.target.value,
                assignee: e.target.value,
              })
            }
            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            placeholder="Assignee name..."
          />
        </div>

        <div>
          <label
            htmlFor={`priority-${task.tempId || index}`}
            className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1 block"
          >
            Priority
          </label>
          <select
            id={`priority-${task.tempId || index}`}
            data-testid="card-priority-select"
            name="priority"
            value={task.priority}
            onChange={(e) =>
              onUpdate(task.tempId, {
                priority: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
              })
            }
            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
          >
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
        </div>
      </div>

      {/* Dependencies tags if present */}
      {task.dependencies && task.dependencies.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <GitCommit className="w-3.5 h-3.5 text-amber-400" />
            Depends on:
          </span>
          {task.dependencies.map((depId) => (
            <span
              key={depId}
              data-testid="candidate-dep-tag"
              className="text-xs px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800"
            >
              {depId}
            </span>
          ))}
        </div>
      )}

      {/* Cycle warning pill on card if individual cycle */}
      {task.cycleError && (
        <div className="text-xs text-red-400 flex items-center gap-1 bg-red-950/40 p-2 rounded border border-red-900">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Circular prerequisite detected on this item.</span>
        </div>
      )}

      {/* Action Buttons: Granular Approve & Reject */}
      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/80">
        <button
          type="button"
          data-testid="card-reject-btn"
          onClick={() => onReject(task.tempId)}
          className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium inline-flex items-center gap-1.5 transition-all active:scale-95"
        >
          <X className="w-3.5 h-3.5" />
          <span>Discard</span>
        </button>

        <button
          type="button"
          data-testid="card-approve-btn"
          onClick={() => onApprove(task.tempId)}
          className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium inline-flex items-center gap-1.5 shadow transition-all active:scale-95"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Approve Task</span>
        </button>
      </div>
    </div>
  );
};
