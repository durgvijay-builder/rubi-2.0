import React, { useState, useMemo } from 'react';
import { useAppState } from '@/context/AppStateContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  History,
  Search,
  RotateCcw,
  PlusCircle,
  CheckCircle,
  Archive,
  RefreshCw,
  GitCommit,
  Tag,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

export const ActivityView: React.FC = () => {
  const { activities, refreshActivities } = useAppState();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshActivities();
    setIsRefreshing(false);
  };

  const filteredActivities = useMemo(() => {
    return activities.filter((act: any) => {
      const type = act.eventType || act.action || '';
      if (actionFilter !== 'ALL' && type !== actionFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const actor = (act.actorName || act.actorId || act.actorType || '').toLowerCase();
        const desc = (act.description || act.taskTitle || '').toLowerCase();
        const matchAction = type.toLowerCase().includes(q);
        return actor.includes(q) || desc.includes(q) || matchAction;
      }
      return true;
    });
  }, [activities, search, actionFilter]);

  const getActionIcon = (action: string) => {
    const act = (action || '').toUpperCase();
    if (act.includes('CREATE')) return <PlusCircle className="h-3.5 w-3.5 text-[#85858b]" />;
    if (act.includes('STATUS')) return <CheckCircle className="h-3.5 w-3.5 text-[#85858b]" />;
    if (act.includes('ARCHIVE')) return <Archive className="h-3.5 w-3.5 text-[#85858b]" />;
    if (act.includes('RESTORE')) return <RotateCcw className="h-3.5 w-3.5 text-[#85858b]" />;
    return <GitCommit className="h-3.5 w-3.5 text-[#85858b]" />;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Audit Stream
            </Badge>
            <span className="font-mono text-xs text-[#85858b] tabular-nums">
              {activities.length} recorded event{activities.length === 1 ? '' : 's'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-[#ededed] mt-1">
            Activity and execution history
          </h1>
          <p className="text-xs sm:text-sm text-[#85858b]">
            Immutable audit trail of task creations, status updates, approvals, and system state transitions
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="text-xs h-9 gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh audit log</span>
        </Button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#85858b]" />
          <Input
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            placeholder="Search by actor, task, or action..."
            className="pl-9 h-9 text-xs sm:text-sm"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          {[
            { key: 'ALL', label: 'All events' },
            { key: 'TASK_CREATED', label: 'Created' },
            { key: 'TASK_STATUS_UPDATED', label: 'Status changes' },
            { key: 'TASK_ARCHIVED', label: 'Archived' },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setActionFilter(f.key)}
              className={`whitespace-nowrap px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                actionFilter === f.key
                  ? 'bg-[#232325] text-[#ededed] border border-border/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                  : 'text-[#85858b] hover:text-[#ededed] hover:bg-[#19191b] border border-transparent'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="space-y-2.5">
        {filteredActivities.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 p-8 text-center space-y-2 bg-[#19191b]">
            <History className="h-6 w-6 text-[#85858b] mx-auto" />
            <h3 className="text-sm font-medium text-[#ededed]">No matching activity events found</h3>
            <p className="text-xs text-[#85858b]">
              Try adjusting your search query or filter segment
            </p>
          </div>
        ) : (
          filteredActivities.map((act: any) => {
            const actionType = act.eventType || act.action || 'ACTIVITY';
            const actionLabel = actionType.toLowerCase().replace(/_/g, ' ');
            const actor = act.actorName || act.actorId || act.actorType || 'User';
            const desc = act.description || act.taskTitle || '';
            const time = act.createdAt || act.timestamp || new Date().toISOString();

            return (
              <Card key={act.id} className="border-border/80 bg-[#19191b]">
                <CardContent className="p-3.5 flex items-start gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#232325] border border-border/80 shrink-0 mt-0.5">
                    {getActionIcon(actionType)}
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-[#ededed]">
                        <span className="font-medium text-[#ededed]">{actor}</span>{' '}
                        <span className="text-[#85858b]">{actionLabel}:</span>{' '}
                        {desc && <span className="text-[#a1a1a6]">&ldquo;{desc}&rdquo;</span>}
                      </p>
                      <span className="font-mono text-[11px] text-[#85858b] whitespace-nowrap tabular-nums">
                        {formatDate(time)}
                      </span>
                    </div>

                    {act.metadata && Object.keys(act.metadata).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5 text-[10px] text-[#85858b]">
                        {act.metadata.fromStatus && act.metadata.toStatus && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#232325] text-[#a1a1a6] border border-border/60">
                            {act.metadata.fromStatus} → {act.metadata.toStatus}
                          </span>
                        )}
                        {act.metadata.actorType && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#232325] text-[#85858b]">
                            {act.metadata.actorType}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
  </div>
);
};
