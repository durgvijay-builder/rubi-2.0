import React, { useState, useMemo } from 'react';
import { useAppState } from '@/context/AppStateContext';
import {
  Bell,
  Plus,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  X,
  ExternalLink,
  ShieldCheck,
  Smartphone,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Link } from 'react-router';

export const RemindersView: React.FC = () => {
  const {
    reminders,
    tasks,
    routines,
    userSettings,
    createReminder,
    cancelReminder,
    deleteReminder,
    refreshReminders,
  } = useAppState();

  const [activeTab, setActiveTab] = useState<'PENDING' | 'DELIVERED' | 'ALL'>('PENDING');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>(() => {
    return typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'default';
  });

  // Create Form State
  const [targetType, setTargetType] = useState<'task' | 'routine'>('task');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [selectedRoutineId, setSelectedRoutineId] = useState<string>('');
  const [remindDate, setRemindDate] = useState<string>('');
  const [remindTime, setRemindTime] = useState<string>('09:00');
  const [customMessage, setCustomMessage] = useState<string>('');

  const filteredReminders = useMemo(() => {
    return reminders.filter((r) => {
      if (activeTab === 'PENDING') return r.status === 'PENDING';
      if (activeTab === 'DELIVERED') return r.status === 'DELIVERED';
      return true;
    });
  }, [reminders, activeTab]);

  const pendingCount = useMemo(() => {
    return reminders.filter((r) => r.status === 'PENDING').length;
  }, [reminders]);

  const deliveredCount = useMemo(() => {
    return reminders.filter((r) => r.status === 'DELIVERED').length;
  }, [reminders]);

  const handleRequestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setBrowserPermission(perm);
    } catch (err) {
      console.warn('Failed to request notification permission:', err);
    }
  };

  const handleOpenCreate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0] ?? '';

    setTargetType('task');
    setSelectedTaskId(tasks[0]?.id || '');
    setSelectedRoutineId(routines[0]?.id || '');
    setRemindDate(dateStr);
    setRemindTime(userSettings?.defaultScheduleReminderTime || '09:00');
    setCustomMessage('');
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remindDate || !remindTime) return;

    try {
      const isoRemindAt = `${remindDate}T${remindTime}:00`;

      await createReminder({
        taskId: targetType === 'task' ? selectedTaskId : null,
        routineId: targetType === 'routine' ? selectedRoutineId : null,
        remindAt: new Date(isoRemindAt).toISOString(),
        message: customMessage.trim() || undefined,
        type: 'custom',
      });

      setIsCreateOpen(false);
      await refreshReminders();
    } catch (err) {
      console.error('Error creating reminder:', err);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelReminder(id);
    } catch (err) {
      console.error('Error cancelling reminder:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteReminder(id);
    } catch (err) {
      console.error('Error deleting reminder:', err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#141415] text-[#ededed] p-4 lg:p-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-[#ededed] flex items-center gap-2">
              <Bell className="h-5 w-5 text-amber-400" />
              Reminders & Notifications
            </h1>
            <Badge variant="outline" className="text-[11px] font-mono border-amber-500/30 text-amber-400 bg-amber-500/10">
              Module Three
            </Badge>
          </div>
          <p className="text-xs text-[#85858b] mt-1">
            Persistent notifications for your scheduled tasks and daily routines.
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="bg-amber-600 hover:bg-amber-500 text-white text-xs h-9 px-3.5 flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New reminder</span>
        </Button>
      </div>

      {/* Browser Notification Permission Banner */}
      <div className="rounded-xl bg-[#19191b] border border-border/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-zinc-800 text-zinc-300 shrink-0">
            <Smartphone className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-medium text-[#ededed] flex items-center gap-2">
              <span>Browser & Web Push Notifications</span>
              <span
                className={cn(
                  'text-[10px] font-mono px-1.5 py-0.2 rounded',
                  browserPermission === 'granted'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : browserPermission === 'denied'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                )}
              >
                {browserPermission.toUpperCase()}
              </span>
            </h3>
            <p className="text-[11px] text-[#85858b] mt-0.5">
              {browserPermission === 'granted'
                ? 'Desktop browser notifications are active. Reminders will pop up even if you are on another tab.'
                : browserPermission === 'denied'
                ? 'Notifications are blocked in your browser settings. You will only receive in-app alerts.'
                : 'Enable browser notifications so you never miss an upcoming schedule or deadline.'}
            </p>
          </div>
        </div>

        {browserPermission !== 'granted' && (
          <Button
            onClick={handleRequestPermission}
            variant="outline"
            className="text-xs h-8 px-3 shrink-0 border-zinc-700 hover:bg-zinc-800"
          >
            Enable notifications
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 bg-[#19191b] p-1 rounded-lg border border-border/80 w-fit">
        <button
          onClick={() => setActiveTab('PENDING')}
          className={cn(
            'px-3 py-1 text-xs rounded-md font-medium transition-colors',
            activeTab === 'PENDING'
              ? 'bg-zinc-800 text-[#ededed]'
              : 'text-[#85858b] hover:text-[#ededed]'
          )}
        >
          Upcoming ({pendingCount})
        </button>
        <button
          onClick={() => setActiveTab('DELIVERED')}
          className={cn(
            'px-3 py-1 text-xs rounded-md font-medium transition-colors',
            activeTab === 'DELIVERED'
              ? 'bg-zinc-800 text-[#ededed]'
              : 'text-[#85858b] hover:text-[#ededed]'
          )}
        >
          Delivered ({deliveredCount})
        </button>
        <button
          onClick={() => setActiveTab('ALL')}
          className={cn(
            'px-3 py-1 text-xs rounded-md font-medium transition-colors',
            activeTab === 'ALL'
              ? 'bg-zinc-800 text-[#ededed]'
              : 'text-[#85858b] hover:text-[#ededed]'
          )}
        >
          All ({reminders.length})
        </button>
      </div>

      {/* Reminders List */}
      {filteredReminders.length === 0 ? (
        <div className="py-16 text-center rounded-xl border border-dashed border-border/80 bg-[#19191b]/50">
          <Bell className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
          <h3 className="text-sm font-medium text-[#ededed]">No reminders</h3>
          <p className="text-xs text-[#85858b] mt-1 max-w-sm mx-auto">
            {activeTab === 'PENDING'
              ? 'No upcoming reminders scheduled. Add a reminder to stay on track.'
              : 'No reminder delivery history found.'}
          </p>
          <Button
            onClick={handleOpenCreate}
            className="mt-4 bg-amber-600 hover:bg-amber-500 text-white text-xs h-8 px-3"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create reminder
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredReminders.map((reminder) => {
            const itemTitle = reminder.task?.title || reminder.routine?.title || 'Personal Item';
            const itemType = reminder.task ? 'Task' : 'Routine';
            const remindDateObj = new Date(reminder.remindAt);

            return (
              <div
                key={reminder.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-[#19191b] border border-border/80 hover:border-zinc-700 transition-all gap-3 shadow-sm"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-zinc-800/80 text-zinc-400 mt-0.5 shrink-0">
                    <Clock className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#ededed] truncate">
                        {itemTitle}
                      </span>
                      <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400 font-mono">
                        {itemType}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] font-mono',
                          reminder.status === 'PENDING'
                            ? 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                            : reminder.status === 'DELIVERED'
                            ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                            : 'border-zinc-700 text-zinc-500'
                        )}
                      >
                        {reminder.status}
                      </Badge>
                    </div>

                    <p className="text-xs text-[#85858b] mt-0.5">
                      {reminder.message || `Scheduled reminder for ${itemTitle}`}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-[#85858b] mt-1 font-mono">
                      <span>
                        Remind at: {remindDateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at{' '}
                        {remindDateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {reminder.type && (
                        <span className="text-[10px] uppercase bg-zinc-800 px-1.5 py-0.2 rounded">
                          {reminder.type}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                  {reminder.status === 'PENDING' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCancel(reminder.id)}
                      className="text-xs h-7 px-2.5 text-zinc-400 hover:text-amber-400"
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(reminder.id)}
                    className="text-xs h-7 w-7 p-0 text-zinc-400 hover:text-rose-400"
                    title="Delete reminder"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reminder Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#19191b] border border-border/80 rounded-xl w-full max-w-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-border/80">
              <h2 className="text-sm font-semibold text-[#ededed] flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-400" />
                Add Personal Reminder
              </h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              {/* Type Switcher */}
              <div className="flex items-center gap-2 bg-[#141415] p-1 rounded-lg border border-border/80">
                <button
                  type="button"
                  onClick={() => setTargetType('task')}
                  className={cn(
                    'flex-1 py-1 text-xs rounded-md font-medium transition-colors',
                    targetType === 'task'
                      ? 'bg-zinc-800 text-[#ededed]'
                      : 'text-[#85858b] hover:text-[#ededed]'
                  )}
                >
                  Link to Task
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType('routine')}
                  className={cn(
                    'flex-1 py-1 text-xs rounded-md font-medium transition-colors',
                    targetType === 'routine'
                      ? 'bg-zinc-800 text-[#ededed]'
                      : 'text-[#85858b] hover:text-[#ededed]'
                  )}
                >
                  Link to Routine
                </button>
              </div>

              {/* Target Picker */}
              {targetType === 'task' ? (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Select task</label>
                  <select
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                    className="w-full bg-[#141415] border border-border/80 rounded-md px-3 py-1.5 text-xs text-[#ededed] focus:outline-none focus:border-amber-500"
                  >
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Select routine</label>
                  <select
                    value={selectedRoutineId}
                    onChange={(e) => setSelectedRoutineId(e.target.value)}
                    className="w-full bg-[#141415] border border-border/80 rounded-md px-3 py-1.5 text-xs text-[#ededed] focus:outline-none focus:border-amber-500"
                  >
                    {routines.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date and Time Picker */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Date</label>
                  <input
                    type="date"
                    required
                    value={remindDate}
                    onChange={(e) => setRemindDate(e.target.value)}
                    className="w-full bg-[#141415] border border-border/80 rounded-md px-3 py-1.5 text-xs text-[#ededed] focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Time</label>
                  <input
                    type="time"
                    required
                    value={remindTime}
                    onChange={(e) => setRemindTime(e.target.value)}
                    className="w-full bg-[#141415] border border-border/80 rounded-md px-3 py-1.5 text-xs text-[#ededed] focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Custom Message */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Custom note (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Prepare presentation notes before meeting"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="w-full bg-[#141415] border border-border/80 rounded-md px-3 py-1.5 text-xs text-[#ededed] focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/80">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsCreateOpen(false)}
                  className="text-xs h-8 text-zinc-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-500 text-white text-xs h-8 px-4"
                >
                  Save reminder
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

