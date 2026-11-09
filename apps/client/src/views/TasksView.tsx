import React, { useState, useMemo } from 'react';
import { useAppState } from '@/context/AppStateContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  CheckCircle2,
  Clock,
  Archive,
  RotateCcw,
  ChevronDown,
  LayoutList,
  Columns3,
  Layers,
  Plus,
  Trash2,
  Calendar,
  Bell,
  Tag,
  CheckSquare,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { TaskItem } from '@/lib/apiClient';

const VIEW_SEGMENTS = [
  { key: 'ALL', label: 'All Tasks' },
  { key: 'TODAY', label: 'Today' },
  { key: 'UPCOMING', label: 'Upcoming' },
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'ARCHIVED', label: 'Archived' },
];

const PRESET_CATEGORIES = ['College', 'Self learning', 'Side hustle', 'Channel', 'Ghar ka!'];
const SLOT_OPTIONS = [
  'Not decided',
  'Morning',
  'Afternoon',
  'After College',
  'Before dinner',
  'After dinner',
  'Night',
];

export const TasksView: React.FC = () => {
  const {
    tasks,
    categories: customCategories,
    activeView,
    setActiveView,
    selectedCategory,
    setSelectedCategory,
    showArchived,
    setShowArchived,
    updateTaskStatus,
    toggleArchiveTask,
    createTask,
    updateTask,
    deleteTask,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    isTasksLoading,
    reminders,
    createReminder,
    cancelReminder,
    deleteReminder,
  } = useAppState();

  const [search, setSearch] = useState('');
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [customReminderDate, setCustomReminderDate] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<TaskItem | null>(null);

  // New Subtask input inside Sheet
  const [newSubtaskInput, setNewSubtaskInput] = useState('');

  // New Task form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [newTaskEffort, setNewTaskEffort] = useState<'SMALL' | 'MEDIUM' | 'LARGE'>('MEDIUM');
  const [newTaskSlot, setNewTaskSlot] = useState('Not decided');
  const [newTaskCategories, setNewTaskCategories] = useState<string[]>([]);
  const [newTaskSchedule, setNewTaskSchedule] = useState('');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [newTaskReminder, setNewTaskReminder] = useState('');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // Combine category pills
  const allCategoryNames = useMemo(() => {
    return Array.from(
      new Set([...PRESET_CATEGORIES, ...(customCategories?.map((c) => c.name) || [])])
    );
  }, [customCategories]);

  // Client-side search filtering (backend already handles view, category, sorting)
  const filteredTasks = useMemo(() => {
    return tasks.filter((task: TaskItem) => {
      if (!search.trim()) return true;
      const query = search.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(query);
      const matchDesc = task.description?.toLowerCase().includes(query) ?? false;
      const matchCategories = task.categories?.some((c) => c.toLowerCase().includes(query)) ?? false;
      return matchTitle || matchDesc || matchCategories;
    });
  }, [tasks, search]);

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'destructive';
      case 'HIGH':
        return 'warning';
      case 'MEDIUM':
        return 'info';
      case 'LOW':
      default:
        return 'secondary';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'BLOCKED':
        return 'destructive';
      case 'IN_PROGRESS':
        return 'info';
      case 'TO_DO':
      default:
        return 'secondary';
    }
  };

  const getStatusDisplay = (task: TaskItem): { label: string; isBlocked: boolean } => {
    const uncompleted = task.dependencies?.filter((depId: string) => {
      const depTask = tasks.find((t) => t.id === depId);
      return !depTask || depTask.status !== 'COMPLETED';
    }) || [];

    if (uncompleted.length > 0 || task.status === 'BLOCKED') {
      const count = uncompleted.length > 0 ? uncompleted.length : (task.dependencies?.length || 1);
      return {
        label: `Waiting on ${count} prerequisite${count > 1 ? 's' : ''}`,
        isBlocked: true,
      };
    }

    if (!task.schedule && !task.deadline && task.status === 'TO_DO') {
      return {
        label: 'Backlog',
        isBlocked: false,
      };
    }

    return {
      label: task.status.replace('_', ' '),
      isBlocked: false,
    };
  };

  const taskReminders = useMemo(() => {
    if (!selectedTask || !reminders) return [];
    return reminders.filter((r) => r.taskId === selectedTask.id);
  }, [selectedTask, reminders]);

  const handleAddPresetReminder = async (task: TaskItem, offsetMinutesBefore: number) => {
    try {
      const baseIso = task.schedule || task.deadline;
      let targetTime: Date;
      if (baseIso) {
        const baseDate = new Date(baseIso);
        targetTime = new Date(baseDate.getTime() - offsetMinutesBefore * 60 * 1000);
      } else {
        targetTime = new Date(Date.now() + Math.max(1, offsetMinutesBefore) * 60 * 1000);
      }

      await createReminder({
        taskId: task.id,
        remindAt: targetTime.toISOString(),
        message: `Reminder: ${task.title}`,
        offsetMinutes: offsetMinutesBefore,
        type: offsetMinutesBefore === 0 ? 'TASK_SCHEDULE' : 'CUSTOM',
      });
    } catch (err) {
      console.error('Failed to create preset reminder:', err);
    }
  };

  const handleAddCustomReminder = async (task: TaskItem) => {
    if (!customReminderDate) return;
    try {
      const targetTime = new Date(customReminderDate);
      if (isNaN(targetTime.getTime())) return;

      await createReminder({
        taskId: task.id,
        remindAt: targetTime.toISOString(),
        message: `Reminder: ${task.title}`,
        type: 'CUSTOM',
      });
      setCustomReminderDate('');
    } catch (err) {
      console.error('Failed to create custom reminder:', err);
    }
  };

  const isOverdue = (task: TaskItem): boolean => {
    if (!task.deadline || task.status === 'COMPLETED' || task.status === 'CANCELLED' || task.isArchived) {
      return false;
    }
    return new Date(task.deadline).getTime() < Date.now();
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      setIsSubmittingNew(true);
      await createTask({
        title: newTaskTitle.trim(),
        description: newTaskDesc.trim() || undefined,
        priority: newTaskPriority,
        effort: newTaskEffort,
        slot: newTaskSlot,
        categories: newTaskCategories,
        scheduledStart: newTaskSchedule ? new Date(newTaskSchedule).toISOString() : null,
        deadline: newTaskDeadline ? new Date(newTaskDeadline).toISOString() : null,
        reminderTime: newTaskReminder ? new Date(newTaskReminder).toISOString() : null,
      });

      // Reset form
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskPriority('MEDIUM');
      setNewTaskEffort('MEDIUM');
      setNewTaskSlot('Not decided');
      setNewTaskCategories([]);
      setNewTaskSchedule('');
      setNewTaskDeadline('');
      setNewTaskReminder('');
      setCreateModalOpen(false);
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setIsSubmittingNew(false);
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!taskToDelete) return;
    try {
      await deleteTask(taskToDelete.id, true);
      setDeleteConfirmOpen(false);
      setTaskToDelete(null);
      if (selectedTask?.id === taskToDelete.id) {
        setSelectedTask(null);
      }
    } catch (err) {
      console.error('Failed to delete task permanently:', err);
    }
  };

  const handleAddSubtaskToTask = async (taskId: string) => {
    if (!newSubtaskInput.trim()) return;
    try {
      await addSubtask(taskId, newSubtaskInput.trim());
      setNewSubtaskInput('');
      // update selectedTask local copy
      if (selectedTask && selectedTask.id === taskId) {
        const updatedSubtasks = [
          ...(selectedTask.subtasks || []),
          {
            id: `temp-${Date.now()}`,
            taskId,
            title: newSubtaskInput.trim(),
            isCompleted: false,
            order: (selectedTask.subtasks?.length || 0),
          },
        ];
        setSelectedTask({ ...selectedTask, subtasks: updatedSubtasks });
      }
    } catch (err) {
      console.error('Failed to add subtask:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-[#ededed]">
            Personal task manager
          </h1>
          <p className="text-xs sm:text-sm text-[#85858b]">
            Organized by nearest deadline, categories, effort level, and scheduled work sessions
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* New Task Button */}
          <Button
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="bg-[#ededed] hover:bg-white text-[#141415] text-xs h-9 px-3.5 gap-1.5 font-medium"
          >
            <Plus className="h-4 w-4" />
            <span>New task</span>
          </Button>

          {/* View Mode Toggle */}
          <div className="hidden xl:flex items-center border border-border/80 rounded-lg p-0.5 bg-[#19191b]">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-7 px-2.5 text-xs gap-1.5 font-normal"
            >
              <LayoutList className="h-3.5 w-3.5" />
              <span>List</span>
            </Button>
            <Button
              variant={viewMode === 'board' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('board')}
              className="h-7 px-2.5 text-xs gap-1.5 font-normal"
            >
              <Columns3 className="h-3.5 w-3.5" />
              <span>Board</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Segmented View Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar border-b border-border/60">
        {VIEW_SEGMENTS.map((seg) => {
          const isActive = activeView === seg.key;
          return (
            <button
              key={seg.key}
              type="button"
              onClick={() => {
                setActiveView(seg.key);
                if (seg.key === 'ARCHIVED') {
                  setShowArchived(true);
                }
              }}
              className={`whitespace-nowrap px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-primary text-[#ededed]'
                  : 'border-transparent text-[#85858b] hover:text-[#ededed]'
              }`}
            >
              {seg.label}
            </button>
          );
        })}
      </div>

      {/* Category Filter Pills & Search */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-normal border transition-colors ${
              selectedCategory === null
                ? 'bg-primary/20 border-primary text-primary-foreground'
                : 'bg-[#232325] border-border/80 text-[#85858b] hover:text-[#ededed]'
            }`}
          >
            All Categories
          </button>
          {allCategoryNames.map((catName) => {
            const isSelected = selectedCategory === catName;
            return (
              <button
                key={catName}
                type="button"
                onClick={() => setSelectedCategory(isSelected ? null : catName)}
                className={`whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-normal border transition-colors ${
                  isSelected
                    ? 'bg-primary/20 border-primary text-primary-foreground'
                    : 'bg-[#232325] border-border/80 text-[#85858b] hover:text-[#ededed]'
                }`}
              >
                {catName}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[200px] md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#85858b]" />
          <Input
            value={search}
            onChange={(e: any) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="pl-9 h-8 text-xs"
          />
        </div>
      </div>

      {/* Task Content: List View vs Board View */}
      {viewMode === 'list' || window.innerWidth < 1280 ? (
        <div className="space-y-2.5">
          {isTasksLoading && (
            <div className="text-center py-8 text-xs text-[#85858b]">
              Loading tasks from workspace...
            </div>
          )}

          {!isTasksLoading && filteredTasks.length === 0 && (
            <div className="rounded-xl border border-dashed border-border/80 p-8 text-center space-y-2 bg-[#19191b]">
              <CheckCircle2 className="h-6 w-6 text-[#85858b] mx-auto" />
              <h3 className="text-sm font-medium text-[#ededed]">No tasks in this view</h3>
              <p className="text-xs text-[#85858b]">
                {selectedCategory ? `No tasks found under category "${selectedCategory}"` : 'Your workload is clear!'}
              </p>
            </div>
          )}

          {filteredTasks.map((task: TaskItem) => {
            const overdue = isOverdue(task);
            const subtasksCount = task.subtasks?.length || 0;
            const completedSubtasks = task.subtasks?.filter((s) => s.isCompleted).length || 0;

            return (
              <Card
                key={task.id}
                className={`border-border/80 bg-[#19191b] hover:bg-[#232325] transition-colors cursor-pointer group ${
                  overdue ? 'border-rose-500/40' : ''
                }`}
                onClick={() => setSelectedTask(task)}
              >
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left Column: Checkbox, Title, Badges */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Fast Status Toggle Checkbox */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateTaskStatus(
                          task.id,
                          task.status === 'COMPLETED' ? 'TO_DO' : 'COMPLETED'
                        );
                      }}
                      className="mt-0.5 shrink-0 h-4 w-4 rounded border border-border/80 flex items-center justify-center transition-colors hover:border-emerald-400"
                    >
                      {task.status === 'COMPLETED' && (
                        <span className="h-2.5 w-2.5 bg-emerald-500 rounded-sm" />
                      )}
                    </button>

                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* Overdue Warning Badge */}
                        {overdue && (
                          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            OVERDUE
                          </span>
                        )}

                        <Badge
                          variant={getPriorityBadgeVariant(task.priority)}
                          className="text-[10px] px-1.5 py-0 font-normal"
                        >
                          {task.priority}
                        </Badge>

                        {task.effort && (
                          <span className="font-mono text-[10px] px-1.5 py-0 rounded bg-[#232325] text-[#a1a1a6] border border-border/60">
                            {task.effort}
                          </span>
                        )}

                        {task.slot && task.slot !== 'Not decided' && (
                          <span className="text-[10px] px-1.5 py-0 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                            {task.slot}
                          </span>
                        )}

                        <span
                          className={`text-xs sm:text-sm font-medium transition-colors truncate ${
                            task.status === 'COMPLETED'
                              ? 'line-through text-[#85858b]'
                              : 'text-[#ededed] group-hover:text-white'
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>

                      {task.description && (
                        <p className="text-xs text-[#85858b] line-clamp-1">
                          {task.description}
                        </p>
                      )}

                      {/* Meta Tags: Categories, Schedule, Deadline, Subtasks */}
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#85858b] pt-0.5">
                        {/* Category badges */}
                        {task.categories && task.categories.length > 0 && (
                          <div className="flex items-center gap-1">
                            {task.categories.map((c) => (
                              <span
                                key={c}
                                className="px-1.5 py-0.2 rounded bg-primary/10 text-primary text-[10px] border border-primary/20"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Scheduled Work Time */}
                        {(task.schedule || task.scheduledStart) && (
                          <span className="flex items-center gap-1 font-mono text-sky-400">
                            <Clock className="h-3 w-3" />
                            <span>Sched: {formatDate(task.schedule || task.scheduledStart)}</span>
                          </span>
                        )}

                        {/* Deadline */}
                        {task.deadline && (
                          <span
                            className={`flex items-center gap-1 font-mono ${
                              overdue ? 'text-rose-400 font-semibold' : ''
                            }`}
                          >
                            <Calendar className="h-3 w-3" />
                            <span>Due: {formatDate(task.deadline)}</span>
                          </span>
                        )}

                        {/* Reminder Badge */}
                        {task.reminderTime && (
                          <span className="flex items-center gap-1 text-amber-400 font-mono">
                            <Bell className="h-3 w-3" />
                            <span>{formatDate(task.reminderTime)}</span>
                          </span>
                        )}

                        {/* Subtasks Progress */}
                        {subtasksCount > 0 && (
                          <span className="flex items-center gap-1 font-mono text-emerald-400">
                            <CheckSquare className="h-3 w-3" />
                            <span>
                              {completedSubtasks}/{subtasksCount}
                            </span>
                          </span>
                        )}

                        {task.dependencies && task.dependencies.length > 0 && (
                          <span className="flex items-center gap-1 text-amber-300 font-mono">
                            <Layers className="h-3 w-3" />
                            <span>{task.dependencies.length} blocked</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Selector Dropdown & Actions */}
                  <div
                    className="flex items-center gap-2 shrink-0 self-end sm:self-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-normal border-border/80 bg-[#141415] hover:bg-[#232325] flex items-center gap-1.5"
                          aria-label={`Change status for ${task.title}`}
                        >
                          <Badge variant={getStatusDisplay(task).isBlocked ? 'destructive' : getStatusBadgeVariant(task.status)} className="text-[10px] px-1.5 py-0">
                            {getStatusDisplay(task).label}
                          </Badge>
                          <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[#19191b] border-border/80">
                        <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'TO_DO')} className="text-xs text-[#ededed] focus:bg-[#232325]">
                          To do
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'IN_PROGRESS')} className="text-xs text-[#ededed] focus:bg-[#232325]">
                          In progress
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'BLOCKED')} className="text-xs text-[#ededed] focus:bg-[#232325]">
                          Blocked
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'COMPLETED')} className="text-xs text-[#ededed] focus:bg-[#232325]">
                          Completed
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-[#85858b] hover:text-[#ededed]"
                      onClick={() => toggleArchiveTask(task.id)}
                      title={task.isArchived ? 'Restore task' : 'Archive task'}
                      aria-label={task.isArchived ? 'Restore task' : 'Archive task'}
                    >
                      {task.isArchived ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5 text-[#85858b]" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Board View (Desktop XL Only) */
        <div className="grid grid-cols-4 gap-4">
          {[
            { key: 'TO_DO', label: 'To do / Backlog' },
            { key: 'IN_PROGRESS', label: 'In progress' },
            { key: 'BLOCKED', label: 'Waiting on prerequisites' },
            { key: 'COMPLETED', label: 'Completed' },
          ].map((col) => {
            const colTasks = filteredTasks.filter((t: TaskItem) => t.status === col.key);
            return (
              <div key={col.key} className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/80">
                  <h3 className="text-xs font-normal text-[#85858b]">{col.label}</h3>
                  <span className="font-mono text-[11px] text-[#85858b] tabular-nums">
                    {colTasks.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {colTasks.map((task: TaskItem) => (
                    <Card
                      key={task.id}
                      className="border-border/80 bg-[#19191b] hover:bg-[#232325] transition-colors cursor-pointer"
                      onClick={() => setSelectedTask(task)}
                    >
                      <CardContent className="p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant={getPriorityBadgeVariant(task.priority)} className="text-[10px] px-1.5 py-0 font-normal">
                            {task.priority}
                          </Badge>
                          {task.effort && (
                            <span className="font-mono text-[10px] text-[#85858b]">
                              {task.effort}
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-medium text-[#ededed] line-clamp-2">
                          {task.title}
                        </h4>
                        {task.categories && task.categories.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {task.categories.map((c) => (
                              <span key={c} className="text-[9px] px-1 py-0.2 rounded bg-primary/10 text-primary">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="text-[10px] text-[#85858b] flex items-center justify-between pt-1 font-mono">
                          {task.deadline ? (
                            <span className={isOverdue(task) ? 'text-rose-400 font-semibold' : ''}>
                              {new Date(task.deadline).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          ) : (
                            <span>Undated</span>
                          )}
                          {task.subtasks && task.subtasks.length > 0 && (
                            <span>{task.subtasks.filter((s) => s.isCompleted).length}/{task.subtasks.length}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task Details Sheet */}
      <Sheet open={Boolean(selectedTask)} onOpenChange={(open: boolean) => !open && setSelectedTask(null)}>
        <SheetContent side="right" className="space-y-6 bg-[#19191b] border-border/80 overflow-y-auto">
          {selectedTask && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <Badge variant={getPriorityBadgeVariant(selectedTask.priority)}>
                    {selectedTask.priority}
                  </Badge>
                  <Badge variant={getStatusDisplay(selectedTask).isBlocked ? 'destructive' : getStatusBadgeVariant(selectedTask.status)}>
                    {getStatusDisplay(selectedTask).label}
                  </Badge>
                  {selectedTask.effort && (
                    <Badge variant="outline" className="text-[10px]">
                      {selectedTask.effort}
                    </Badge>
                  )}
                </div>
                <SheetTitle className="text-base font-medium text-left pt-2 text-[#ededed]">
                  {selectedTask.title}
                </SheetTitle>
                <SheetDescription className="text-left font-mono text-xs text-[#85858b]">
                  Task ID: {selectedTask.id}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 text-xs">
                {/* Description */}
                <div>
                  <h4 className="font-normal text-[#85858b] mb-1">Description / Notes</h4>
                  <p className="text-[#a1a1a6] leading-relaxed whitespace-pre-wrap">
                    {selectedTask.description || 'No description provided'}
                  </p>
                </div>

                {/* Categories */}
                {selectedTask.categories && selectedTask.categories.length > 0 && (
                  <div>
                    <h4 className="font-normal text-[#85858b] mb-1">Categories</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTask.categories.map((c) => (
                        <span
                          key={c}
                          className="px-2 py-0.5 rounded-md bg-primary/20 text-primary-foreground border border-primary text-xs"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Grid: Schedule, Deadline, Slot, Reminder */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[#141415] border border-border/80">
                  <div>
                    <span className="text-[#85858b] block text-[10px]">Schedule (Work session)</span>
                    <span className="font-mono text-[#ededed]">
                      {selectedTask.schedule || selectedTask.scheduledStart
                        ? formatDate(selectedTask.schedule || selectedTask.scheduledStart)
                        : 'Unscheduled'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[#85858b] block text-[10px]">Deadline</span>
                    <span
                      className={`font-mono ${
                        isOverdue(selectedTask) ? 'text-rose-400 font-semibold' : 'text-[#ededed]'
                      }`}
                    >
                      {formatDate(selectedTask.deadline)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[#85858b] block text-[10px]">Time Slot</span>
                    <span className="text-[#ededed]">{selectedTask.slot || 'Not decided'}</span>
                  </div>

                  <div>
                    <span className="text-[#85858b] block text-[10px]">Reminder Time</span>
                    <span className="font-mono text-[#ededed]">
                      {selectedTask.reminderTime ? formatDate(selectedTask.reminderTime) : 'None'}
                    </span>
                  </div>
                </div>

                {/* Subtasks Checklist */}
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <h4 className="font-normal text-[#85858b] flex items-center justify-between">
                    <span>Subtasks Checklist ({selectedTask.subtasks?.length || 0})</span>
                  </h4>

                  <div className="space-y-1.5">
                    {selectedTask.subtasks?.map((st) => (
                      <div
                        key={st.id}
                        className="flex items-center justify-between gap-2 p-2 rounded bg-[#141415] border border-border/60 text-xs"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={st.isCompleted}
                            onChange={async () => {
                              await toggleSubtask(selectedTask.id, st.id);
                              // update selected task state
                              const updated = selectedTask.subtasks.map((item) =>
                                item.id === st.id ? { ...item, isCompleted: !item.isCompleted } : item
                              );
                              setSelectedTask({ ...selectedTask, subtasks: updated });
                            }}
                            className="rounded border-border/80 h-3.5 w-3.5 cursor-pointer accent-emerald-500"
                          />
                          <span
                            className={
                              st.isCompleted ? 'line-through text-[#85858b] truncate' : 'text-[#ededed] truncate'
                            }
                          >
                            {st.title}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            await deleteSubtask(selectedTask.id, st.id);
                            const updated = selectedTask.subtasks.filter((item) => item.id !== st.id);
                            setSelectedTask({ ...selectedTask, subtasks: updated });
                          }}
                          className="h-6 w-6 p-0 text-[#85858b] hover:text-[#e5484d]"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Add Subtask Input */}
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      value={newSubtaskInput}
                      onChange={(e) => setNewSubtaskInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSubtaskToTask(selectedTask.id);
                        }
                      }}
                      placeholder="Add checklist item..."
                      className="h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleAddSubtaskToTask(selectedTask.id)}
                      className="h-8 px-2 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Dependencies DAG */}
                {selectedTask.dependencies && selectedTask.dependencies.length > 0 && (
                  <div>
                    <h4 className="font-normal text-[#85858b] mb-1">Prerequisites (Dependencies)</h4>
                    <div className="space-y-1">
                      {selectedTask.dependencies.map((depId: any) => (
                        <div
                          key={depId}
                          className="p-2 rounded bg-[#141415] text-[11px] flex items-center justify-between border border-border/60"
                        >
                          <span className="font-mono text-[#a1a1a6]">{depId}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Task Reminders Manager */}
                <div className="space-y-3 pt-4 border-t border-border/80">
                  <div className="flex items-center justify-between">
                    <h4 className="font-normal text-[#85858b] flex items-center gap-1.5">
                      <Bell className="h-3.5 w-3.5 text-amber-400" />
                      <span>Reminders</span>
                    </h4>
                    <span className="font-mono text-[10px] text-[#85858b]">
                      {taskReminders.length} scheduled
                    </span>
                  </div>

                  {/* Active / Past Reminders List */}
                  {taskReminders.length > 0 ? (
                    <div className="space-y-1.5">
                      {taskReminders.map((rem) => (
                        <div
                          key={rem.id}
                          className="flex items-center justify-between p-2 rounded bg-[#141415] border border-border/60 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Clock className="h-3 w-3 text-amber-400 shrink-0" />
                            <span className="text-[#ededed] font-mono text-[11px] truncate">
                              {formatDate(rem.remindAt)}
                            </span>
                            <Badge
                              variant={
                                rem.status === 'PENDING'
                                  ? 'secondary'
                                  : rem.status === 'DELIVERED'
                                    ? 'success'
                                    : 'outline'
                              }
                              className="text-[9px] px-1 py-0 shrink-0"
                            >
                              {rem.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {rem.status === 'PENDING' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => cancelReminder(rem.id)}
                                className="h-6 px-1.5 text-[10px] text-zinc-400 hover:text-white"
                              >
                                Cancel
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteReminder(rem.id)}
                              className="h-6 w-6 p-0 text-[#85858b] hover:text-[#e5484d]"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#85858b] italic">
                      No reminders configured for this task.
                    </p>
                  )}

                  {/* Quick Preset Buttons */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] text-[#85858b] block">Quick reminders:</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddPresetReminder(selectedTask, 5)}
                        className="h-7 text-[10px] bg-[#141415] border-border/80 hover:bg-[#232325]"
                      >
                        5m before
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddPresetReminder(selectedTask, 10)}
                        className="h-7 text-[10px] bg-[#141415] border-border/80 hover:bg-[#232325]"
                      >
                        10m before
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddPresetReminder(selectedTask, 15)}
                        className="h-7 text-[10px] bg-[#141415] border-border/80 hover:bg-[#232325]"
                      >
                        15m before
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddPresetReminder(selectedTask, 30)}
                        className="h-7 text-[10px] bg-[#141415] border-border/80 hover:bg-[#232325]"
                      >
                        30m before
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddPresetReminder(selectedTask, 40)}
                        className="h-7 text-[10px] bg-[#141415] border-border/80 hover:bg-[#232325]"
                      >
                        40m before
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddPresetReminder(selectedTask, 0)}
                        className="h-7 text-[10px] bg-[#141415] border-border/80 hover:bg-[#232325]"
                      >
                        At task time
                      </Button>
                    </div>
                  </div>

                  {/* Custom Date & Time Picker */}
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      type="datetime-local"
                      value={customReminderDate}
                      onChange={(e) => setCustomReminderDate(e.target.value)}
                      className="h-8 text-xs bg-[#141415]"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleAddCustomReminder(selectedTask)}
                      disabled={!customReminderDate}
                      className="h-8 px-2.5 text-xs shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      <span>Set</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Status Actions & Permanent Delete in Sheet */}
              <div className="space-y-3 pt-4 border-t border-border/80">
                <span className="text-xs text-[#85858b] block">Change status</span>
                <div className="grid grid-cols-2 gap-2">
                  {['TO_DO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'].map((st) => (
                    <Button
                      key={st}
                      variant={selectedTask.status === st ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => {
                        updateTaskStatus(selectedTask.id, st);
                        setSelectedTask({ ...selectedTask, status: st as any });
                      }}
                    >
                      {st.replace('_', ' ').toLowerCase()}
                    </Button>
                  ))}
                </div>

                {/* Permanent Delete Trigger Button */}
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTaskToDelete(selectedTask);
                      setDeleteConfirmOpen(true);
                    }}
                    className="w-full text-xs text-[#e5484d] hover:bg-rose-950/40 hover:text-white border-rose-500/30 h-8 gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Task Permanently</span>
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Manual Task Creation Dialog Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="bg-[#19191b] border-border/80 max-w-lg">
          <form onSubmit={handleCreateTask} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-sm font-medium text-[#ededed]">Create personal task</DialogTitle>
              <DialogDescription className="text-xs text-[#85858b]">
                Add a new task directly to your personal workload with schedule and deadline
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-xs text-[#85858b]">Task title *</label>
                <Input
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. Complete math assignment"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#85858b]">Description</label>
                <Textarea
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  rows={2}
                  placeholder="Additional context or notes..."
                  className="text-xs"
                />
              </div>

              {/* Categories */}
              <div className="space-y-1.5">
                <label className="text-xs text-[#85858b]">Categories</label>
                <div className="flex flex-wrap gap-1.5">
                  {allCategoryNames.map((catName) => {
                    const isSelected = newTaskCategories.includes(catName);
                    return (
                      <button
                        key={catName}
                        type="button"
                        onClick={() => {
                          setNewTaskCategories((prev) =>
                            prev.includes(catName) ? prev.filter((c) => c !== catName) : [...prev, catName]
                          );
                        }}
                        className={`px-2.5 py-1 rounded text-xs border ${
                          isSelected
                            ? 'bg-primary/20 border-primary text-primary-foreground'
                            : 'bg-[#232325] border-border/80 text-[#85858b]'
                        }`}
                      >
                        {isSelected && '✓ '}
                        {catName}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Priority, Effort, Slot */}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-[#85858b]">Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e: any) => setNewTaskPriority(e.target.value)}
                    className="w-full h-8 px-2 text-xs rounded border border-border/80 bg-[#232325] text-[#ededed]"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-[#85858b]">Effort</label>
                  <select
                    value={newTaskEffort}
                    onChange={(e: any) => setNewTaskEffort(e.target.value)}
                    className="w-full h-8 px-2 text-xs rounded border border-border/80 bg-[#232325] text-[#ededed]"
                  >
                    <option value="SMALL">SMALL</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LARGE">LARGE</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-[#85858b]">Slot</label>
                  <select
                    value={newTaskSlot}
                    onChange={(e: any) => setNewTaskSlot(e.target.value)}
                    className="w-full h-8 px-2 text-xs rounded border border-border/80 bg-[#232325] text-[#ededed]"
                  >
                    {SLOT_OPTIONS.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Schedule, Deadline, Reminder */}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-[#85858b] flex items-center gap-1">
                    <Clock className="h-3 w-3 text-sky-400" />
                    <span>Schedule</span>
                  </label>
                  <Input
                    type="datetime-local"
                    value={newTaskSchedule}
                    onChange={(e) => setNewTaskSchedule(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-[#85858b] flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-rose-400" />
                    <span>Deadline</span>
                  </label>
                  <Input
                    type="datetime-local"
                    value={newTaskDeadline}
                    onChange={(e) => setNewTaskDeadline(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-[#85858b] flex items-center gap-1">
                    <Bell className="h-3 w-3 text-amber-400" />
                    <span>Reminder</span>
                  </label>
                  <Input
                    type="datetime-local"
                    value={newTaskReminder}
                    onChange={(e) => setNewTaskReminder(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateModalOpen(false)}
                className="text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingNew}
                className="bg-[#ededed] hover:bg-white text-[#141415] text-xs h-9 font-medium"
              >
                {isSubmittingNew ? 'Creating...' : 'Create Task'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Explicit Permanent Delete Confirmation Dialog Modal */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-[#19191b] border-border/80">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium text-[#e5484d] flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>Confirm permanent deletion</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#85858b]">
              Are you sure you want to permanently delete "{taskToDelete?.title}"? An immutable snapshot will be logged in your activity history, but the task record and subtasks will be removed from PostgreSQL.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setTaskToDelete(null);
              }}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmPermanentDelete}
              className="text-xs h-9"
            >
              Permanently Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
