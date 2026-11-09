import { useState, useEffect, useCallback } from 'react';
import {
  apiClient,
  type TaskItem,
  type CandidateTask,
  type ActivityItem,
  type ExtractResponse,
  type CategoryItem,
  type UserSettingsItem,
  type DueReminderItem,
  type SubtaskItem,
} from '../lib/apiClient.js';

export function useTasks(_workspaceId = 'workspace-rubi-demo-001') {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [routines, setRoutines] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettingsItem | null>(null);
  const [dueReminders, setDueReminders] = useState<DueReminderItem[]>([]);

  const [activeView, setActiveView] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // HITL Staging State (Silence Never Implies Consent)
  const [stagedCandidates, setStagedCandidates] = useState<CandidateTask[]>([]);
  const [extractionSummary, setExtractionSummary] = useState<string>('');
  const [ambiguities, setAmbiguities] = useState<string[]>([]);
  const [hasCycle, setHasCycle] = useState(false);
  const [cycleNodes, setCycleNodes] = useState<string[]>([]);
  const [tokensTelemetry, setTokensTelemetry] = useState<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  }>({
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
  });

  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.getTasks({
        archived: activeView === 'ARCHIVED' || showArchived,
        view: activeView,
        category: selectedCategory || undefined,
        search: searchQuery || undefined,
      });
      if (res?.tasks && Array.isArray(res.tasks)) {
        setTasks(res.tasks);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeView, showArchived, selectedCategory, searchQuery]);

  const fetchActivities = useCallback(async () => {
    try {
      const res = await apiClient.getActivities({ limit: 50 });
      if (res?.activities && Array.isArray(res.activities)) {
        setActivities(res.activities);
      }
    } catch (err) {
      console.error('Failed to fetch activities:', err);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await apiClient.getCategories();
      if (res?.categories && Array.isArray(res.categories)) {
        setCategories(res.categories);
      }
    } catch (err) {
      console.warn('Failed to fetch categories:', err);
    }
  }, []);

  const fetchUserSettings = useCallback(async () => {
    try {
      const res = await apiClient.getUserSettings();
      if (res?.settings) {
        setUserSettings(res.settings);
      }
    } catch (err) {
      console.warn('Failed to fetch user settings:', err);
    }
  }, []);

  const fetchRoutines = useCallback(async () => {
    try {
      const res = await apiClient.getRoutines();
      if (res?.data && Array.isArray(res.data)) {
        setRoutines(res.data);
      }
    } catch (err) {
      console.warn('Failed to fetch routines:', err);
    }
  }, []);

  const fetchReminders = useCallback(async () => {
    try {
      const res = await apiClient.getReminders();
      if (res?.reminders && Array.isArray(res.reminders)) {
        setReminders(res.reminders);
      }
    } catch (err) {
      console.warn('Failed to fetch reminders:', err);
    }
  }, []);

  const checkDueReminders = useCallback(async () => {
    try {
      const res = await apiClient.getDueReminders();
      if (res?.reminders && Array.isArray(res.reminders)) {
        setDueReminders(res.reminders);
      }
    } catch (err) {
      console.warn('Failed to fetch due reminders:', err);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    fetchRoutines();
  }, [fetchRoutines]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  useEffect(() => {
    fetchCategories();
    fetchUserSettings();
    checkDueReminders();
    const interval = setInterval(checkDueReminders, 15000);
    return () => clearInterval(interval);
  }, [fetchCategories, fetchUserSettings, checkDueReminders]);

  // Set extraction result in staging queue (enforces "silence never implies consent")
  const stageExtraction = useCallback((data: ExtractResponse) => {
    setExtractionSummary(data.summary || '');
    setStagedCandidates(data.tasks || []);
    setAmbiguities(data.ambiguities || []);
    setHasCycle(Boolean(data.hasCycle || (data.tasks && data.tasks.some((t) => t.cycleError))));
    setCycleNodes(data.cycleNodes || []);
    if (data.tokensUsed) {
      setTokensTelemetry(data.tokensUsed);
    }
  }, []);

  // Update candidate fields in staging queue
  const updateCandidate = useCallback((tempId: string, updates: Partial<CandidateTask>) => {
    setStagedCandidates((prev) =>
      prev.map((c) => (c.tempId === tempId ? { ...c, ...updates } : c))
    );
  }, []);

  // Granular approve single candidate
  const approveSingleCandidate = useCallback(
    async (tempId: string) => {
      const candidate = stagedCandidates.find((c) => c.tempId === tempId);
      if (!candidate) return;

      try {
        setIsApproving(true);
        if (candidate.isRoutine) {
          await apiClient.createRoutine({
            title: candidate.title,
            description: candidate.description || '',
            recurrencePattern: (candidate.recurrencePattern as any) || 'DAILY',
            preferredSlot: candidate.slot || undefined,
            categories: candidate.categories || [],
          });
          setStagedCandidates((prev) => prev.filter((c) => c.tempId !== tempId));
          await fetchActivities();
          return;
        }

        const res = await apiClient.approveSingle(candidate);
        if (res?.success && res?.tasks) {
          setStagedCandidates((prev) => prev.filter((c) => c.tempId !== tempId));
          await fetchTasks();
          await fetchActivities();
        }
      } catch (err) {
        console.error('Failed to approve candidate:', err);
      } finally {
        setIsApproving(false);
      }
    },
    [stagedCandidates, fetchTasks, fetchActivities]
  );

  // Granular reject single candidate
  const rejectSingleCandidate = useCallback((tempId: string) => {
    setStagedCandidates((prev) => prev.filter((c) => c.tempId !== tempId));
  }, []);

  // Batch approve all valid candidate tasks
  const batchApproveCandidates = useCallback(async () => {
    if (stagedCandidates.length === 0 || hasCycle) return;

    try {
      setIsApproving(true);
      const routineCandidates = stagedCandidates.filter((c) => c.isRoutine);
      const taskCandidates = stagedCandidates.filter((c) => !c.isRoutine);

      for (const rc of routineCandidates) {
        await apiClient.createRoutine({
          title: rc.title,
          description: rc.description || '',
          recurrencePattern: (rc.recurrencePattern as any) || 'DAILY',
          preferredSlot: rc.slot || undefined,
          categories: rc.categories || [],
        });
      }

      if (taskCandidates.length > 0) {
        const res = await apiClient.approveBatch(taskCandidates);
        if (res?.success && res?.tasks) {
          await fetchTasks();
        }
      }
      setStagedCandidates([]);
      await fetchActivities();
    } catch (err) {
      console.error('Failed to batch approve candidates:', err);
    } finally {
      setIsApproving(false);
    }
  }, [stagedCandidates, hasCycle, fetchTasks, fetchActivities]);

  // Discard all candidates
  const discardAllCandidates = useCallback(() => {
    setStagedCandidates([]);
    setAmbiguities([]);
    setHasCycle(false);
    setCycleNodes([]);
  }, []);

  // Manual Task Creation
  const createTask = useCallback(
    async (data: Partial<CandidateTask>) => {
      try {
        const res = await apiClient.createTask(data);
        await fetchTasks();
        await fetchActivities();
        return res.task;
      } catch (err) {
        console.error('Failed to create task:', err);
        throw err;
      }
    },
    [fetchTasks, fetchActivities]
  );

  // Update Task fields (title, priority, effort, slot, categories, deadline, schedule, subtasks)
  const updateTask = useCallback(
    async (taskId: string, patch: any) => {
      try {
        const res = await apiClient.updateTask(taskId, patch);
        await fetchTasks();
        await fetchActivities();
        return res.task;
      } catch (err) {
        console.error('Failed to update task:', err);
        throw err;
      }
    },
    [fetchTasks, fetchActivities]
  );

  // Task Status Update (with cascade handling)
  const updateTaskStatus = useCallback(
    async (taskId: string, newStatus: string) => {
      try {
        await apiClient.updateTask(taskId, { status: newStatus });
        await fetchTasks();
        await fetchActivities();
      } catch (err) {
        console.error('Failed to update task status:', err);
      }
    },
    [fetchTasks, fetchActivities]
  );

  // Permanent Delete or Soft Archive
  const deleteTask = useCallback(
    async (taskId: string, permanent = false) => {
      try {
        await apiClient.deleteTask(taskId, permanent);
        await fetchTasks();
        await fetchActivities();
      } catch (err) {
        console.error('Failed to delete task:', err);
        throw err;
      }
    },
    [fetchTasks, fetchActivities]
  );

  // Toggle soft archival
  const toggleArchiveTask = useCallback(
    async (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      try {
        if (task.isArchived) {
          await apiClient.restoreTask(taskId);
        } else {
          await apiClient.archiveTask(taskId);
        }
        await fetchTasks();
        await fetchActivities();
      } catch (err) {
        console.error('Failed to toggle archive task:', err);
      }
    },
    [tasks, fetchTasks, fetchActivities]
  );

  // Subtask Actions
  const addSubtask = useCallback(
    async (taskId: string, title: string, order?: number): Promise<SubtaskItem | undefined> => {
      try {
        const res = await apiClient.addSubtask(taskId, title, order);
        await fetchTasks();
        return res.subtask;
      } catch (err) {
        console.error('Failed to add subtask:', err);
        throw err;
      }
    },
    [fetchTasks]
  );

  const updateSubtask = useCallback(
    async (
      taskId: string,
      subtaskId: string,
      patch: { title?: string; isCompleted?: boolean; order?: number }
    ): Promise<SubtaskItem | undefined> => {
      try {
        const res = await apiClient.updateSubtask(taskId, subtaskId, patch);
        await fetchTasks();
        return res.subtask;
      } catch (err) {
        console.error('Failed to update subtask:', err);
        throw err;
      }
    },
    [fetchTasks]
  );

  const toggleSubtask = useCallback(
    async (taskId: string, subtaskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      const subtask = task?.subtasks?.find((s) => s.id === subtaskId);
      if (!subtask) return;

      return updateSubtask(taskId, subtaskId, { isCompleted: !subtask.isCompleted });
    },
    [tasks, updateSubtask]
  );

  const deleteSubtask = useCallback(
    async (taskId: string, subtaskId: string) => {
      try {
        await apiClient.deleteSubtask(taskId, subtaskId);
        await fetchTasks();
      } catch (err) {
        console.error('Failed to delete subtask:', err);
        throw err;
      }
    },
    [fetchTasks]
  );

  // Category Actions
  const createCategory = useCallback(
    async (name: string, color?: string) => {
      try {
        await apiClient.createCategory(name, color);
        await fetchCategories();
      } catch (err) {
        console.error('Failed to create category:', err);
        throw err;
      }
    },
    [fetchCategories]
  );

  const updateCategory = useCallback(
    async (categoryId: string, patch: { name?: string | undefined; color?: string | undefined }) => {
      try {
        const res = await apiClient.updateCategory(categoryId, patch);
        await fetchCategories();
        return res?.category;
      } catch (err) {
        console.error('Failed to update category:', err);
        throw err;
      }
    },
    [fetchCategories]
  );

  const deleteCategory = useCallback(
    async (categoryId: string) => {
      try {
        await apiClient.deleteCategory(categoryId);
        await fetchCategories();
        if (selectedCategory && selectedCategory === categories.find((c) => c.id === categoryId)?.name) {
          setSelectedCategory(null);
        }
      } catch (err) {
        console.error('Failed to delete category:', err);
        throw err;
      }
    },
    [categories, fetchCategories, selectedCategory]
  );

  // Routine Actions (Module Two)
  const createRoutine = useCallback(
    async (data: any) => {
      try {
        const res = await apiClient.createRoutine(data);
        await fetchRoutines();
        return res?.data;
      } catch (err) {
        console.error('Failed to create routine:', err);
        throw err;
      }
    },
    [fetchRoutines]
  );

  const updateRoutine = useCallback(
    async (id: string, patch: any) => {
      try {
        const res = await apiClient.updateRoutine(id, patch);
        await fetchRoutines();
        return res?.data;
      } catch (err) {
        console.error('Failed to update routine:', err);
        throw err;
      }
    },
    [fetchRoutines]
  );

  const deleteRoutine = useCallback(
    async (id: string) => {
      try {
        await apiClient.deleteRoutine(id);
        await fetchRoutines();
      } catch (err) {
        console.error('Failed to delete routine:', err);
        throw err;
      }
    },
    [fetchRoutines]
  );

  const toggleRoutineOccurrence = useCallback(
    async (id: string, date: string, status = 'COMPLETED', notes?: string) => {
      try {
        const res = await apiClient.toggleRoutineOccurrence(id, date, status, notes);
        await fetchRoutines();
        return res?.data;
      } catch (err) {
        console.error('Failed to toggle routine occurrence:', err);
        throw err;
      }
    },
    [fetchRoutines]
  );

  // Reminder Actions (Module Three)
  const createReminder = useCallback(
    async (data: {
      taskId?: string | null | undefined;
      routineId?: string | null | undefined;
      remindAt: string;
      message?: string | undefined;
      type?: string | undefined;
    }) => {
      try {
        const res = await apiClient.createReminder(data);
        await fetchReminders();
        return res?.reminder;
      } catch (err) {
        console.error('Failed to create reminder:', err);
        throw err;
      }
    },
    [fetchReminders]
  );

  const updateReminder = useCallback(
    async (id: string, patch: any) => {
      try {
        const res = await apiClient.updateReminder(id, patch);
        await fetchReminders();
        return res?.reminder;
      } catch (err) {
        console.error('Failed to update reminder:', err);
        throw err;
      }
    },
    [fetchReminders]
  );

  const cancelReminder = useCallback(
    async (id: string) => {
      try {
        await apiClient.cancelReminder(id);
        await fetchReminders();
      } catch (err) {
        console.error('Failed to cancel reminder:', err);
        throw err;
      }
    },
    [fetchReminders]
  );

  const deleteReminder = useCallback(
    async (id: string) => {
      try {
        await apiClient.deleteReminder(id);
        await fetchReminders();
      } catch (err) {
        console.error('Failed to delete reminder:', err);
        throw err;
      }
    },
    [fetchReminders]
  );

  // Settings Actions
  const updateUserSettings = useCallback(async (patch: any) => {
    try {
      const res = await apiClient.updateUserSettings(patch);
      if (res?.settings) {
        setUserSettings(res.settings);
      }
    } catch (err) {
      console.error('Failed to update user settings:', err);
      throw err;
    }
  }, []);

  return {
    tasks,
    routines,
    reminders,
    activities,
    categories,
    userSettings,
    dueReminders,
    activeView,
    setActiveView,
    selectedCategory,
    setSelectedCategory,
    showArchived,
    setShowArchived,
    searchQuery,
    setSearchQuery,
    isLoading,
    isApproving,
    stagedCandidates,
    extractionSummary,
    ambiguities,
    hasCycle,
    cycleNodes,
    tokensTelemetry,
    stageExtraction,
    updateCandidate,
    approveSingleCandidate,
    rejectSingleCandidate,
    batchApproveCandidates,
    discardAllCandidates,
    createTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
    toggleArchiveTask,
    addSubtask,
    updateSubtask,
    toggleSubtask,
    deleteSubtask,
    createCategory,
    updateCategory,
    deleteCategory,
    createRoutine,
    updateRoutine,
    deleteRoutine,
    toggleRoutineOccurrence,
    createReminder,
    updateReminder,
    cancelReminder,
    deleteReminder,
    updateUserSettings,
    checkDueReminders,
    refreshTasks: fetchTasks,
    refreshRoutines: fetchRoutines,
    refreshReminders: fetchReminders,
    refreshActivities: fetchActivities,
  };
}
