import React from 'react';
import { Calendar, User, GitCommit, Archive, RotateCcw } from 'lucide-react';
import { formatDate } from '../../lib/utils.js';
import type { TaskItem } from '../../lib/apiClient.js';

interface TaskCardProps {
  task: TaskItem;
  onStatusChange: (taskId: string, newStatus: string) => void;
  onToggleArchive: (taskId: string) => void;
}

const PRIORITY_BADGES: Record<string, string> = {
  LOW: 'bg-slate-800 text-slate-300 border-slate-700',
  MEDIUM: 'bg-blue-950/80 text-blue-300 border-blue-700',
  HIGH: 'bg-amber-950/80 text-amber-300 border-amber-700',
  CRITICAL: 'bg-red-950/80 text-red-300 border-red-700 font-bold',
};

const STATUS_OPTIONS = [
  { value: 'TO_DO', label: 'TO_DO' },
  { value: 'IN_PROGRESS', label: 'IN_PROGRESS' },
  { value: 'BLOCKED', label: 'BLOCKED' },
  { value: 'COMPLETED', label: 'COMPLETED' },
  { value: 'CANCELLED', label: 'CANCELLED' },
  { value: 'ARCHIVED', label: 'ARCHIVED' },
];

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onStatusChange,
  onToggleArchive,
}) => {
  const priorityClass = PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.MEDIUM;

  return (
    <div
      data-testid={`task-card-${task.id}`}
      data-status={task.status}
      className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 shadow-md flex flex-col gap-2.5 transition-all hover:border-slate-700 w-full min-w-0 max-w-full overflow-hidden break-words"
    >
      {/* Top Header: Title & Priority Pill */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-sm text-slate-100 leading-snug break-words">
          {task.title}
        </h4>
        <span
          className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${priorityClass}`}
        >
          {task.priority}
        </span>
      </div>

      {/* Description if present */}
      {task.description && (
        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Dependency Badges */}
      {task.dependencies && task.dependencies.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            data-testid="dependency-tag"
            className="text-[11px] px-2 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-800 font-medium inline-flex items-center gap-1"
          >
            <GitCommit className="w-3 h-3" />
            <span>BLOCKED BY: {task.dependencies.join(', ')}</span>
          </span>
        </div>
      )}

      {/* Metadata: Assignee & Deadline */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1 border-t border-slate-800/80">
        <div className="flex items-center gap-1">
          <User className="w-3.5 h-3.5 text-slate-500" />
          <span>{task.assignee || task.owner || 'Unassigned'}</span>
        </div>

        {task.deadline && (
          <div className="flex items-center gap-1 text-[11px]">
            <Calendar className="w-3 h-3 text-slate-500" />
            <span>{formatDate(task.deadline)}</span>
          </div>
        )}
      </div>

      {/* Footer Controls: Status Selector & Archive Action */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
        <select
          data-testid="task-status-select"
          name="status"
          value={task.status}
          onChange={(e) => onStatusChange(task.id, e.target.value)}
          className="bg-slate-900 border border-slate-700/80 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[44px] min-w-[44px] cursor-pointer"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          data-testid="archive-task-btn"
          onClick={() => onToggleArchive(task.id)}
          className="min-h-[44px] min-w-[44px] px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium inline-flex items-center gap-1.5 transition-all active:scale-95"
        >
          {task.isArchived ? (
            <>
              <RotateCcw className="w-3 h-3 text-emerald-400" />
              <span>Restore</span>
            </>
          ) : (
            <>
              <Archive className="w-3 h-3 text-slate-400" />
              <span>Archive</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
