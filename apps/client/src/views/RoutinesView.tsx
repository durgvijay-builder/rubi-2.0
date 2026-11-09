import React, { useState, useMemo } from 'react';
import { useAppState } from '@/context/AppStateContext';
import {
  Repeat,
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  Tag,
  Calendar,
  X,
  Trash2,
  Edit2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DEFAULT_SLOTS } from '@rubi/shared';

const DAYS_MAP = [
  { day: 1, short: 'M', full: 'Mon' },
  { day: 2, short: 'T', full: 'Tue' },
  { day: 3, short: 'W', full: 'Wed' },
  { day: 4, short: 'T', full: 'Thu' },
  { day: 5, short: 'F', full: 'Fri' },
  { day: 6, short: 'S', full: 'Sat' },
  { day: 7, short: 'S', full: 'Sun' },
];

export const RoutinesView: React.FC = () => {
  const {
    routines,
    categories,
    userSettings,
    createRoutine,
    updateRoutine,
    deleteRoutine,
    toggleRoutineOccurrence,
  } = useAppState();

  const [activeTab, setActiveTab] = useState<'ALL' | 'DAILY' | 'WEEKLY'>('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<any | null>(null);
  const [routineToDelete, setRoutineToDelete] = useState<any | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    category: string;
    frequency: 'DAILY' | 'WEEKLY';
    daysOfWeek: number[];
    slot: string;
    time: string;
    targetPerWeek: number;
    reminderTime: string;
    isActive: boolean;
  }>({
    title: '',
    description: '',
    category: '',
    frequency: 'DAILY',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    slot: 'Morning',
    time: '07:00',
    targetPerWeek: 1,
    reminderTime: '',
    isActive: true,
  });

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0] || '', []);
  const todayDayOfWeek = useMemo(() => {
    const day = new Date().getDay();
    return day === 0 ? 7 : day; // 1=Mon, ..., 7=Sun
  }, []);

  const allAvailableSlots = useMemo(() => {
    const custom = userSettings?.customSlots || [];
    return Array.from(new Set([...DEFAULT_SLOTS, ...custom]));
  }, [userSettings]);

  // Routines filtered by category and frequency
  const filteredRoutines = useMemo(() => {
    return routines.filter((r) => {
      if (activeTab === 'DAILY' && r.frequency !== 'DAILY') return false;
      if (activeTab === 'WEEKLY' && r.frequency !== 'WEEKLY') return false;
      if (selectedCategory && r.category !== selectedCategory) return false;
      return true;
    });
  }, [routines, activeTab, selectedCategory]);

  // Routines scheduled for today
  const todaysRoutines = useMemo(() => {
    return routines.filter((r) => {
      if (!r.isActive) return false;
      if (r.frequency === 'DAILY') {
        return r.daysOfWeek.includes(todayDayOfWeek);
      }
      return r.daysOfWeek.includes(todayDayOfWeek);
    });
  }, [routines, todayDayOfWeek]);

  const completedTodayCount = useMemo(() => {
    return todaysRoutines.filter((r) => r.completedToday).length;
  }, [todaysRoutines]);

  const handleOpenCreate = () => {
    setFormData({
      title: '',
      description: '',
      category: categories[0]?.name || 'Self learning',
      frequency: 'DAILY',
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      slot: 'Morning',
      time: '07:00',
      targetPerWeek: 1,
      reminderTime: '15 mins before',
      isActive: true,
    });
    setEditingRoutine(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (routine: any) => {
    setFormData({
      title: routine.title,
      description: routine.description || '',
      category: routine.category || '',
      frequency: routine.frequency || 'DAILY',
      daysOfWeek: routine.daysOfWeek || [1, 2, 3, 4, 5, 6, 7],
      slot: routine.slot || 'Morning',
      time: routine.time || '07:00',
      targetPerWeek: routine.targetPerWeek || 1,
      reminderTime: routine.reminderTime || '',
      isActive: routine.isActive ?? true,
    });
    setEditingRoutine(routine);
    setIsCreateOpen(true);
  };

  const handleSaveRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    try {
      if (editingRoutine) {
        await updateRoutine(editingRoutine.id, formData);
      } else {
        await createRoutine(formData);
      }
      setIsCreateOpen(false);
      setEditingRoutine(null);
    } catch (err) {
      console.error('Error saving routine:', err);
    }
  };

  const handleToggleToday = async (routineId: string) => {
    try {
      await toggleRoutineOccurrence(routineId, todayStr, 'COMPLETED');
    } catch (err) {
      console.error('Error toggling routine completion:', err);
    }
  };

  const handleToggleDaySelection = (dayNum: number) => {
    setFormData((prev) => {
      const exists = prev.daysOfWeek.includes(dayNum);
      const nextDays = exists
        ? prev.daysOfWeek.filter((d) => d !== dayNum)
        : [...prev.daysOfWeek, dayNum].sort((a, b) => a - b);
      return { ...prev, daysOfWeek: nextDays.length === 0 ? [dayNum] : nextDays };
    });
  };

  const handleSetPreset = (preset: 'ALL' | 'WEEKDAYS' | 'WEEKENDS') => {
    if (preset === 'ALL') {
      setFormData((prev) => ({ ...prev, daysOfWeek: [1, 2, 3, 4, 5, 6, 7] }));
    } else if (preset === 'WEEKDAYS') {
      setFormData((prev) => ({ ...prev, daysOfWeek: [1, 2, 3, 4, 5] }));
    } else {
      setFormData((prev) => ({ ...prev, daysOfWeek: [6, 7] }));
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!routineToDelete) return;
    try {
      await deleteRoutine(routineToDelete.id);
      setRoutineToDelete(null);
    } catch (err) {
      console.error('Error deleting routine:', err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#141415] text-[#ededed] p-4 lg:p-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-[#ededed] flex items-center gap-2">
              <Repeat className="h-5 w-5 text-indigo-400" />
              Routines & Habits
            </h1>
            <Badge variant="outline" className="text-[11px] font-mono border-indigo-500/30 text-indigo-400 bg-indigo-500/10">
              Module Two
            </Badge>
          </div>
          <p className="text-xs text-[#85858b] mt-1">
            Build consistent daily and weekly recurring habits that persist across sessions.
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 px-3.5 flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New routine</span>
        </Button>
      </div>

      {/* Today's Checklist Hero Strip */}
      <div className="rounded-xl bg-[#19191b] border border-border/80 p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-medium text-[#ededed]">Today's Schedule</h2>
            <span className="text-xs text-[#85858b]">
              ({completedTodayCount} of {todaysRoutines.length} completed)
            </span>
          </div>

          <div className="w-32 bg-zinc-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{
                width: todaysRoutines.length > 0 ? `${(completedTodayCount / todaysRoutines.length) * 100}%` : '0%',
              }}
            />
          </div>
        </div>

        {todaysRoutines.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#85858b]">
            No routines scheduled for today. Take a break or add a new routine below!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {todaysRoutines.map((routine) => {
              const isDone = routine.completedToday;
              return (
                <div
                  key={routine.id}
                  onClick={() => handleToggleToday(routine.id)}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer group',
                    isDone
                      ? 'bg-emerald-950/20 border-emerald-500/30'
                      : 'bg-[#141415] border-border/80 hover:border-zinc-600'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <button
                      type="button"
                      className="shrink-0 text-zinc-400 group-hover:text-emerald-400 transition-colors"
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-400 fill-emerald-950" />
                      ) : (
                        <Circle className="h-5 w-5 text-zinc-600 group-hover:text-zinc-400" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <div
                        className={cn(
                          'text-xs font-medium truncate',
                          isDone ? 'line-through text-zinc-400' : 'text-[#ededed]'
                        )}
                      >
                        {routine.title}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[#85858b] mt-0.5">
                        {routine.time && <span>{routine.time}</span>}
                        {routine.slot && routine.slot !== 'Not decided' && (
                          <span className="bg-zinc-800 px-1.5 py-0.2 rounded text-[10px]">
                            {routine.slot}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {routine.category && (
                    <Badge variant="outline" className="text-[10px] shrink-0 border-zinc-700 text-zinc-400">
                      {routine.category}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tabs & Category Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 bg-[#19191b] p-1 rounded-lg border border-border/80 w-fit">
          <button
            onClick={() => setActiveTab('ALL')}
            className={cn(
              'px-3 py-1 text-xs rounded-md font-medium transition-colors',
              activeTab === 'ALL'
                ? 'bg-zinc-800 text-[#ededed]'
                : 'text-[#85858b] hover:text-[#ededed]'
            )}
          >
            All Routines ({routines.length})
          </button>
          <button
            onClick={() => setActiveTab('DAILY')}
            className={cn(
              'px-3 py-1 text-xs rounded-md font-medium transition-colors',
              activeTab === 'DAILY'
                ? 'bg-zinc-800 text-[#ededed]'
                : 'text-[#85858b] hover:text-[#ededed]'
            )}
          >
            Daily
          </button>
          <button
            onClick={() => setActiveTab('WEEKLY')}
            className={cn(
              'px-3 py-1 text-xs rounded-md font-medium transition-colors',
              activeTab === 'WEEKLY'
                ? 'bg-zinc-800 text-[#ededed]'
                : 'text-[#85858b] hover:text-[#ededed]'
            )}
          >
            Weekly
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              'text-xs px-2.5 py-1 rounded-full border transition-colors whitespace-nowrap',
              selectedCategory === null
                ? 'bg-zinc-800 text-[#ededed] border-zinc-700'
                : 'bg-transparent text-[#85858b] border-border/80 hover:text-[#ededed]'
            )}
          >
            All categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full border transition-colors whitespace-nowrap flex items-center gap-1.5',
                selectedCategory === cat.name
                  ? 'bg-zinc-800 text-[#ededed] border-zinc-700'
                  : 'bg-transparent text-[#85858b] border-border/80 hover:text-[#ededed]'
              )}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: cat.color || '#71717a' }}
              />
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Routine Cards Grid */}
      {filteredRoutines.length === 0 ? (
        <div className="py-16 text-center rounded-xl border border-dashed border-border/80 bg-[#19191b]/50">
          <Repeat className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
          <h3 className="text-sm font-medium text-[#ededed]">No routines found</h3>
          <p className="text-xs text-[#85858b] mt-1 max-w-sm mx-auto">
            Create recurring daily and weekly habits to maintain routines and stay organized.
          </p>
          <Button
            onClick={handleOpenCreate}
            className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8 px-3"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add first routine
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRoutines.map((routine) => {
            return (
              <div
                key={routine.id}
                className={cn(
                  'rounded-xl bg-[#19191b] border border-border/80 p-4 flex flex-col justify-between transition-all hover:border-zinc-700 space-y-4 shadow-sm',
                  !routine.isActive && 'opacity-60'
                )}
              >
                {/* Top Section */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[#ededed] leading-snug">
                      {routine.title}
                    </h3>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEdit(routine)}
                        className="h-7 w-7 p-0 text-zinc-400 hover:text-[#ededed]"
                        title="Edit routine"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRoutineToDelete(routine)}
                        className="h-7 w-7 p-0 text-zinc-400 hover:text-rose-400"
                        title="Delete routine"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {routine.description && (
                    <p className="text-xs text-[#85858b] line-clamp-2">
                      {routine.description}
                    </p>
                  )}
                </div>

                {/* Recurrence Schedule Indicator */}
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between text-xs text-[#85858b]">
                    <span className="font-mono text-[11px] uppercase">
                      {routine.frequency}
                    </span>
                    <div className="flex items-center gap-1">
                      {routine.time && (
                        <span className="flex items-center gap-1 font-mono text-[11px]">
                          <Clock className="h-3 w-3 text-zinc-500" />
                          {routine.time}
                        </span>
                      )}
                      {routine.slot && routine.slot !== 'Not decided' && (
                        <span className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded text-[10px]">
                          {routine.slot}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 7-Day Week Indicator */}
                  <div className="flex items-center justify-between gap-1 pt-1">
                    {DAYS_MAP.map(({ day, short }) => {
                      const isScheduledDay = routine.daysOfWeek.includes(day);
                      const isToday = day === todayDayOfWeek;
                      return (
                        <div
                          key={day}
                          className={cn(
                            'flex-1 text-center py-1 rounded text-[10px] font-mono border transition-colors',
                            isScheduledDay
                              ? isToday
                                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-bold'
                                : 'bg-zinc-800/80 border-zinc-700 text-zinc-300'
                              : 'bg-transparent border-transparent text-zinc-600'
                          )}
                        >
                          {short}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Row / Status Toggle */}
                <div className="flex items-center justify-between pt-1">
                  {routine.category ? (
                    <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">
                      {routine.category}
                    </Badge>
                  ) : <span />}

                  <button
                    onClick={() => updateRoutine(routine.id, { isActive: !routine.isActive })}
                    className={cn(
                      'text-[11px] font-mono px-2 py-0.5 rounded transition-colors',
                      routine.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-zinc-800 text-zinc-500 hover:text-zinc-400'
                    )}
                  >
                    {routine.isActive ? 'Active' : 'Paused'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Routine Creation & Edit Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#19191b] border border-border/80 rounded-xl w-full max-w-lg p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-border/80">
              <h2 className="text-sm font-semibold text-[#ededed] flex items-center gap-2">
                <Repeat className="h-4 w-4 text-indigo-400" />
                {editingRoutine ? 'Edit Routine' : 'Create Recurring Routine'}
              </h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRoutine} className="space-y-4">
              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Routine title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Exercise, Python practice, Cycling"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-[#141415] border border-border/80 rounded-md px-3 py-1.5 text-xs text-[#ededed] focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Description (optional)</label>
                <textarea
                  rows={2}
                  placeholder="Additional notes or checklist..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-[#141415] border border-border/80 rounded-md px-3 py-1.5 text-xs text-[#ededed] focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Frequency & Category */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Frequency</label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                    className="w-full bg-[#141415] border border-border/80 rounded-md px-3 py-1.5 text-xs text-[#ededed] focus:outline-none focus:border-indigo-500"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-[#141415] border border-border/80 rounded-md px-3 py-1.5 text-xs text-[#ededed] focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">No category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Days of Week Selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-300">Scheduled days</label>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => handleSetPreset('ALL')}
                      className="text-indigo-400 hover:underline"
                    >
                      Every day
                    </button>
                    <span className="text-zinc-600">|</span>
                    <button
                      type="button"
                      onClick={() => handleSetPreset('WEEKDAYS')}
                      className="text-indigo-400 hover:underline"
                    >
                      Weekdays
                    </button>
                    <span className="text-zinc-600">|</span>
                    <button
                      type="button"
                      onClick={() => handleSetPreset('WEEKENDS')}
                      className="text-indigo-400 hover:underline"
                    >
                      Weekends
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {DAYS_MAP.map(({ day, full }) => {
                    const selected = formData.daysOfWeek.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleToggleDaySelection(day)}
                        className={cn(
                          'py-1.5 text-xs font-mono rounded-md border text-center transition-colors',
                          selected
                            ? 'bg-indigo-600 text-white border-indigo-500 font-semibold'
                            : 'bg-[#141415] text-zinc-400 border-border/80 hover:border-zinc-600'
                        )}
                      >
                        {full}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preferred Slot & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Preferred Slot</label>
                  <select
                    value={formData.slot}
                    onChange={(e) => setFormData({ ...formData, slot: e.target.value })}
                    className="w-full bg-[#141415] border border-border/80 rounded-md px-3 py-1.5 text-xs text-[#ededed] focus:outline-none focus:border-indigo-500"
                  >
                    {allAvailableSlots.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Preferred Time</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full bg-[#141415] border border-border/80 rounded-md px-3 py-1.5 text-xs text-[#ededed] focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
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
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8 px-4"
                >
                  {editingRoutine ? 'Save changes' : 'Create routine'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {routineToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#19191b] border border-border/80 rounded-xl w-full max-w-sm p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-[#ededed]">Delete Routine</h3>
            </div>

            <p className="text-xs text-[#85858b] leading-relaxed">
              Are you sure you want to delete <strong className="text-[#ededed]">"{routineToDelete.title}"</strong>?
              This will remove the routine definition and its occurrence history.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setRoutineToDelete(null)}
                className="text-xs h-8 text-zinc-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteConfirmed}
                className="bg-rose-600 hover:bg-rose-500 text-white text-xs h-8 px-3.5"
              >
                Delete routine
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
