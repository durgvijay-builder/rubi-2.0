import React from 'react';
import { Search, LayoutGrid } from 'lucide-react';
import { TaskCard } from './TaskCard.js';
import type { TaskItem } from '../../lib/apiClient.js';

interface TaskBoardProps {
  tasks: TaskItem[];
  showArchived: boolean;
  searchQuery: string;
  onToggleShowArchived: (checked: boolean) => void;
  onSearchChange: (query: string) => void;
  onStatusChange: (taskId: string, newStatus: string) => void;
  onToggleArchive: (taskId: string) => void;
}

const ALL_STATUSES = [
  { id: 'PENDING_APPROVAL', label: 'Pending Approval', color: 'border-slate-700 bg-slate-900/60' },
  { id: 'TO_DO', altId: 'TODO', label: 'To Do', color: 'border-blue-900/80 bg-blue-950/20' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'border-amber-900/80 bg-amber-950/20' },
  { id: 'BLOCKED', label: 'Blocked', color: 'border-red-900/80 bg-red-950/20' },
  { id: 'COMPLETED', label: 'Completed', color: 'border-emerald-900/80 bg-emerald-950/20' },
  { id: 'CANCELLED', label: 'Cancelled', color: 'border-slate-800 bg-slate-950/40' },
  { id: 'ARCHIVED', label: 'Archived', color: 'border-purple-900/60 bg-purple-950/20' },
];

export const TaskBoard: React.FC<TaskBoardProps> = ({
  tasks,
  showArchived,
  searchQuery,
  onToggleShowArchived,
  onSearchChange,
  onStatusChange,
  onToggleArchive,
}) => {
  // Filter tasks by showArchived and search query
  const filteredTasks = tasks.filter((t) => {
    if (showArchived) {
      if (!t.isArchived && t.status !== 'ARCHIVED') return false;
    } else {
      if (t.isArchived || t.status === 'ARCHIVED') return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q) || false;
      const matchAssignee = t.assignee?.toLowerCase().includes(q) || false;
      return matchTitle || matchDesc || matchAssignee;
    }

    return true;
  });

  return (
    <section
      data-testid="task-board"
      aria-label="Task Management Board"
      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-xl flex flex-col gap-4"
    >
      {/* Header & Controls: Title, Search & Filter Checkbox */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-blue-400" />
          <h2 className="text-base sm:text-lg font-bold text-slate-100">Task Board</h2>
          <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
            {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Filter Input */}
          <div className="relative min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              data-testid="task-search-input"
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>

          {/* Archived Filter Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300 min-h-[44px] px-2 py-1 rounded bg-slate-950/60 border border-slate-800">
            <input
              id="show-archived"
              data-testid="filter-archived-checkbox"
              type="checkbox"
              checked={showArchived}
              onChange={(e) => onToggleShowArchived(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <span>Show Archived</span>
          </label>
        </div>
      </div>

      {/* Kanban Multi-Column View */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {ALL_STATUSES.map((statusObj) => {
          const colStatus = statusObj.id;
          const statusTasks = filteredTasks.filter(
            (t) => t.status === colStatus || (statusObj.altId && t.status === statusObj.altId)
          );

          // Build dual data-testid e.g. "column-TO_DO column-TODO" or "column-COMPLETED"
          const testIdAttr = statusObj.altId
            ? `column-${colStatus} column-${statusObj.altId}`
            : `column-${colStatus}`;

          return (
            <div
              key={colStatus}
              data-testid={testIdAttr}
              data-status={colStatus}
              className={`rounded-lg border p-3 flex flex-col gap-3 min-w-0 ${statusObj.color}`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  {statusObj.label}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                  {statusTasks.length}
                </span>
              </div>

              {/* Cards in this column */}
              <div className="flex flex-col gap-2.5 min-h-[60px]">
                {statusTasks.length === 0 ? (
                  <div className="text-[11px] text-slate-600 italic text-center py-4">
                    No tasks
                  </div>
                ) : (
                  statusTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={onStatusChange}
                      onToggleArchive={onToggleArchive}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
