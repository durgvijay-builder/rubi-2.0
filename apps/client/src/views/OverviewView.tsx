import React from 'react';
import { Link } from 'react-router';
import { useAppState } from '@/context/AppStateContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Mic,
  CheckSquare,
  ShieldCheck,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingUp,
  Activity,
  UserCheck,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

export const OverviewView: React.FC = () => {
  const {
    tasks,
    activities,
    stagedCandidates,
    workspace,
    isRecording,
    startRecording,
    stopRecording,
  } = useAppState();

  const activeTasks = tasks.filter(
    (t: any) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && !t.isArchived,
  );
  const completedTasks = tasks.filter((t: any) => t.status === 'COMPLETED');
  const blockedTasks = tasks.filter((t: any) => t.status === 'BLOCKED');
  const pendingApprovalsCount = stagedCandidates.length;

  const totalCount = tasks.length;
  const completionRate =
    totalCount > 0 ? Math.round((completedTasks.length / totalCount) * 100) : 0;

  const upcomingTasks = activeTasks.slice(0, 4);
  const recentActivities = activities.slice(0, 5);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Workspace Operational Header */}
      <div className="rounded-xl border border-border/80 bg-[#19191b] p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-[#85858b]">WORKSPACE</span>
              <span className="text-xs text-[#85858b]">·</span>
              <span className="text-xs text-[#ededed] font-medium">
                {workspace?.name || 'Gnani Demo — Product Launch'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-[#ededed]">
              Operations overview
            </h1>
            <p className="text-xs sm:text-sm text-[#85858b] max-w-xl">
              Multilingual speech capture, Gemini DAG schema extraction, and human gate verification
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link to="/voice">
              <Button
                className="bg-[#ededed] hover:bg-white text-[#141415] font-medium text-xs h-10 px-4 gap-2"
              >
                <Mic className="h-4 w-4" />
                <span>Voice Studio</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row — Clean Figures without decorative filler */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-[#19191b] border-border/80">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs text-[#85858b]">
              Active tasks
            </CardDescription>
            <CardTitle className="text-2xl font-medium text-[#ededed] font-mono tabular-nums mt-0.5">
              {activeTasks.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-[11px] text-[#85858b]">In progress & to-do items</p>
          </CardContent>
        </Card>

        <Card className="bg-[#19191b] border-border/80">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs text-[#85858b]">
              Pending review
            </CardDescription>
            <CardTitle className="text-2xl font-medium text-[#ededed] font-mono tabular-nums mt-0.5">
              {pendingApprovalsCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-[11px] text-[#85858b]">
              {pendingApprovalsCount > 0 ? (
                <span className="text-amber-300 font-medium">Awaiting explicit human approval</span>
              ) : (
                'Zero backlog awaiting review'
              )}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#19191b] border-border/80">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs text-[#85858b]">
              Completion rate
            </CardDescription>
            <CardTitle className="text-2xl font-medium text-[#ededed] font-mono tabular-nums mt-0.5">
              {completionRate}%
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-[11px] text-[#85858b] tabular-nums">{completedTasks.length} of {totalCount} completed</p>
          </CardContent>
        </Card>

        <Card className="bg-[#19191b] border-border/80">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs text-[#85858b]">
              Blocked tasks
            </CardDescription>
            <CardTitle className="text-2xl font-medium text-[#ededed] font-mono tabular-nums mt-0.5">
              {blockedTasks.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-[11px] text-[#85858b]">Waiting on dependencies</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Voice Capture Deck Bar */}
      <Card className="border-border/80 bg-[#19191b]">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-lg border transition-colors shrink-0 ${
                  isRecording
                    ? 'bg-rose-600 text-white border-rose-500'
                    : 'bg-[#232325] text-[#ededed] hover:bg-[#2c2c30] border-border/80'
                }`}
                aria-label={isRecording ? 'Stop recording voice' : 'Start quick voice recording'}
              >
                <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <h2 className="text-xs sm:text-sm font-medium text-[#ededed] truncate">
                  {isRecording ? 'Recording audio stream...' : 'Quick voice capture'}
                </h2>
                <p className="text-xs text-[#85858b] flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span>Dictate or press</span>
                  <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#232325] border border-border/80 text-[#ededed]">
                    Space
                  </kbd>
                </p>
              </div>
            </div>

            <div className="w-full sm:w-auto shrink-0 pt-1 sm:pt-0">
              <Link to="/voice" className="block w-full sm:w-auto">
                <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs h-9 gap-1.5">
                  <span>Open Voice Studio</span>
                  <ArrowRight className="h-3.5 w-3.5 text-[#85858b]" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Staging Alert if queue > 0 */}
      {pendingApprovalsCount > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h2 className="text-xs sm:text-sm font-medium text-amber-200">
                {pendingApprovalsCount} candidate task{pendingApprovalsCount > 1 ? 's' : ''} require approval
              </h2>
              <p className="text-xs text-amber-300/80">
                Silence never implies consent: proposed work remains staged until confirmed
              </p>
            </div>
            <Link to="/approvals" className="shrink-0">
              <Button size="sm" className="bg-amber-400 hover:bg-amber-300 text-[#141415] font-medium text-xs h-8">
                Review queue
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Two Column Grid: Upcoming Tasks & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Tasks */}
        <Card className="border-border/80 bg-[#19191b]">
          <CardHeader className="p-4 sm:p-5 pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xs sm:text-sm font-medium">Active tasks</CardTitle>
              <CardDescription className="text-xs">Immediate sprint priorities</CardDescription>
            </div>
            <Link to="/tasks">
              <Button variant="ghost" size="sm" className="text-xs h-8 text-[#85858b] hover:text-[#ededed] gap-1 px-2">
                <span>View all</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0 space-y-2">
            {upcomingTasks.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#85858b]">
                No active tasks found in this workspace
              </div>
            ) : (
              upcomingTasks.map((task: any) => (
                <div
                  key={task.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border/60 bg-[#141415] hover:bg-[#232325] transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <span className="text-xs font-medium text-[#ededed] truncate block">
                      {task.title}
                    </span>
                    <div className="flex items-center gap-3 text-[11px] text-[#85858b]">
                      {task.deadline && (
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="h-3 w-3" />
                          {formatDate(task.deadline)}
                        </span>
                      )}
                      {task.assignee && (
                        <span className="flex items-center gap-1">
                          <UserCheck className="h-3 w-3" />
                          {task.assignee}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant={
                      task.status === 'BLOCKED'
                        ? 'destructive'
                        : task.status === 'IN_PROGRESS'
                        ? 'info'
                        : 'secondary'
                    }
                    className="text-[10px] px-1.5 py-0 shrink-0 font-normal"
                  >
                    {task.status.replace('_', ' ')}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-border/80 bg-[#19191b]">
          <CardHeader className="p-4 sm:p-5 pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xs sm:text-sm font-medium">Recent activity</CardTitle>
              <CardDescription className="text-xs">Immutable audit event stream</CardDescription>
            </div>
            <Link to="/activity">
              <Button variant="ghost" size="sm" className="text-xs h-8 text-[#85858b] hover:text-[#ededed] gap-1 px-2">
                <span>View history</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0 space-y-2.5">
            {recentActivities.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#85858b]">
                No recent activity logged
              </div>
            ) : (
              recentActivities.map((act: any) => {
                const actionLabel = (act.eventType || act.action || 'ACTIVITY').toLowerCase().replace(/_/g, ' ');
                const actor = act.actorName || act.actorId || act.actorType || 'System';
                const desc = act.description || act.taskTitle || 'Activity logged';
                const time = act.createdAt || act.timestamp || new Date().toISOString();

                return (
                  <div key={act.id} className="flex items-start gap-3 text-xs">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#232325] border border-border/80 shrink-0 mt-0.5">
                      <Activity className="h-3 w-3 text-[#85858b]" />
                    </div>
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <p className="text-[#ededed] leading-snug">
                        <span className="font-medium text-[#ededed]">{actor}</span>{' '}
                        <span className="text-[#85858b]">{actionLabel}:</span>{' '}
                        <span className="text-[#a1a1a6]">{desc}</span>
                      </p>
                      <p className="font-mono text-[10px] text-[#85858b] tabular-nums">
                        {new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
