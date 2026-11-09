import React from 'react';
import { History, Clock } from 'lucide-react';
import { formatDate } from '../../lib/utils.js';
import type { ActivityItem } from '../../lib/apiClient.js';

interface ActivityTimelineProps {
  activities: ActivityItem[];
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ activities }) => {
  return (
    <section
      data-testid="activity-timeline"
      aria-label="Activity history"
      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-xl flex flex-col gap-4"
    >
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <History className="w-5 h-5 text-indigo-400" />
        <h2 className="text-base sm:text-lg font-bold text-slate-100">Immutable Activity History</h2>
        <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full ml-auto">
          {activities.length} {activities.length === 1 ? 'event' : 'events'}
        </span>
      </div>

      <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1">
        {activities.length === 0 ? (
          <div className="text-xs text-slate-500 italic text-center py-6">
            No activity events recorded yet.
          </div>
        ) : (
          activities.map((act) => (
            <div
              key={act.id}
              data-testid={`activity-item-${act.id}`}
              className="activity-item bg-slate-950 border border-slate-800/80 rounded-lg p-3 text-xs flex flex-col gap-1 transition-all hover:border-slate-700"
            >
              <div className="flex items-center justify-between gap-2">
                {/* Verbatim uppercase eventType string for test assertion */}
                <strong className="font-bold text-indigo-300">
                  {act.eventType}
                </strong>

                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Clock className="w-3 h-3" />
                  <span>{formatDate(act.createdAt)}</span>
                </div>
              </div>

              {act.description && (
                <p className="text-slate-300 text-xs leading-relaxed">
                  {act.description}
                </p>
              )}

              {act.taskId && (
                <div className="text-[11px] text-slate-500 font-mono">
                  Task ID: {act.taskId}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
};
