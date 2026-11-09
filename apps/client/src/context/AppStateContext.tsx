import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useWorkspace } from '../hooks/useWorkspace.js';
import { useVoicePipeline, type ProcessingState } from '../hooks/useVoicePipeline.js';
import { useTasks } from '../hooks/useTasks.js';
import {
  apiClient,
  type CandidateTask,
  type TaskItem,
  type ActivityItem,
  type HealthResponse,
  type CategoryItem,
  type UserSettingsItem,
  type DueReminderItem,
  type SubtaskItem,
} from '../lib/apiClient.js';

interface AppStateContextValue {
  // Workspace
  workspaceId: string;
  workspace: any;
  currentUser: any;
  isWorkspaceLoading: boolean;
  workspaceError: string | null;
  switchWorkspace: (id: string) => void;
  refetchWorkspace: () => void;

  // Voice Pipeline
  processingState: ProcessingState;
  setProcessingState: (state: ProcessingState) => void;
  isRecording: boolean;
  recordingSeconds: number;
  formattedTimer: string;
  audioError: string | null;
  setAudioError: (err: string | null) => void;
  transcript: string;
  setTranscript: (text: string) => void;
  wordCount: number;
  confidence: number | null;
  detectedLanguage: string | null;
  ttsSpokenText: string | null;
  setTtsSpokenText: (text: string | null) => void;
  ttsAudioUrl: string | null;
  setTtsAudioUrl: (url: string | null) => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  handleFileUpload: (file: File) => Promise<void>;
  playConfirmation: (text: string) => Promise<void>;
  extractFromTranscript: () => Promise<boolean>;
  isExtracting: boolean;

  // Tasks & HITL Staging
  tasks: TaskItem[];
  routines: any[];
  reminders: any[];
  activities: ActivityItem[];
  categories: CategoryItem[];
  userSettings: UserSettingsItem | null;
  dueReminders: DueReminderItem[];
  activeView: string;
  setActiveView: (view: string) => void;
  selectedCategory: string | null;
  setSelectedCategory: (cat: string | null) => void;
  showArchived: boolean;
  setShowArchived: (val: boolean) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  isTasksLoading: boolean;
  isApproving: boolean;
  stagedCandidates: CandidateTask[];
  extractionSummary: string;
  ambiguities: string[];
  hasCycle: boolean;
  cycleNodes: string[];
  tokensTelemetry: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  updateCandidate: (tempId: string, updates: Partial<CandidateTask>) => void;
  approveSingleCandidate: (tempId: string) => Promise<void>;
  rejectSingleCandidate: (tempId: string) => void;
  batchApproveCandidates: () => Promise<void>;
  discardAllCandidates: () => void;
  createTask: (data: Partial<CandidateTask>) => Promise<TaskItem>;
  updateTask: (taskId: string, patch: any) => Promise<TaskItem>;
  deleteTask: (taskId: string, permanent?: boolean) => Promise<void>;
  updateTaskStatus: (taskId: string, newStatus: string) => Promise<void>;
  toggleArchiveTask: (taskId: string) => Promise<void>;
  addSubtask: (taskId: string, title: string, order?: number) => Promise<SubtaskItem | undefined>;
  updateSubtask: (
    taskId: string,
    subtaskId: string,
    patch: { title?: string; isCompleted?: boolean; order?: number }
  ) => Promise<SubtaskItem | undefined>;
  toggleSubtask: (taskId: string, subtaskId: string) => Promise<SubtaskItem | undefined>;
  deleteSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  createCategory: (name: string, color?: string) => Promise<void>;
  updateCategory: (id: string, patch: { name?: string | undefined; color?: string | undefined }) => Promise<any>;
  deleteCategory: (id: string) => Promise<void>;
  createRoutine: (data: any) => Promise<any>;
  updateRoutine: (id: string, patch: any) => Promise<any>;
  deleteRoutine: (id: string) => Promise<void>;
  toggleRoutineOccurrence: (id: string, date: string, status?: string, notes?: string) => Promise<any>;
  createReminder: (data: any) => Promise<any>;
  updateReminder: (id: string, patch: any) => Promise<any>;
  cancelReminder: (id: string) => Promise<any>;
  deleteReminder: (id: string) => Promise<void>;
  updateUserSettings: (patch: any) => Promise<void>;
  checkDueReminders: () => Promise<void>;
  refreshTasks: () => Promise<void>;
  refreshRoutines: () => Promise<void>;
  refreshReminders: () => Promise<void>;
  refreshActivities: () => Promise<void>;

  // System & Preferences
  health: HealthResponse | null;
  verifyProviders: () => Promise<void>;
  reducedMotion: boolean;
  setReducedMotion: (val: boolean) => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const workspaceState = useWorkspace();
  const voiceState = useVoicePipeline();
  const taskState = useTasks(workspaceState.workspaceId);

  const [isExtracting, setIsExtracting] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [reducedMotion, setReducedMotionState] = useState<boolean>(() => {
    return localStorage.getItem('rubi_reduced_motion') === 'true';
  });

  const verifyProviders = useCallback(async () => {
    try {
      const updated = await apiClient.verifyProviders();
      setHealth(updated);
    } catch (err) {
      console.warn('Failed to verify providers:', err);
    }
  }, []);

  const setReducedMotion = useCallback((val: boolean) => {
    setReducedMotionState(val);
    localStorage.setItem('rubi_reduced_motion', String(val));
    if (val) {
      document.documentElement.classList.add('reduce-motion');
    } else {
      document.documentElement.classList.remove('reduce-motion');
    }
  }, []);

  // Sync reduced-motion class on mount
  useEffect(() => {
    if (reducedMotion) {
      document.documentElement.classList.add('reduce-motion');
    } else {
      document.documentElement.classList.remove('reduce-motion');
    }
  }, [reducedMotion]);

  // Fetch health on mount and periodically
  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      try {
        const h = await apiClient.getHealth();
        if (mounted) {
          setHealth(h);
        }
      } catch {
        if (mounted) {
          setHealth({ status: 'offline', mode: 'offline', timestamp: new Date().toISOString(), uptime: 0 });
        }
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // When workspace changes, trigger task and activity reload
  const { refreshTasks, refreshActivities } = taskState;
  useEffect(() => {
    refreshTasks();
    refreshActivities();
  }, [workspaceState.workspaceId, refreshTasks, refreshActivities]);

  // Semantic extraction trigger from voice/text transcript.
  // Returns boolean success flag to guard navigation.
  const extractFromTranscript = useCallback(async (): Promise<boolean> => {
    const text = voiceState.transcript.trim();
    if (!text) return false;

    setIsExtracting(true);
    voiceState.setAudioError(null);
    try {
      voiceState.setProcessingState('understanding');
      const timezone = taskState.userSettings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
      const result = await apiClient.extractActions(text, { timezone });

      // Deterministic Intent Router bypass (M4 F18)
      if (result.bypassLLM) {
        if (result.intent === 'MARK_COMPLETED' && result.affectedTaskId) {
          await taskState.updateTaskStatus(result.affectedTaskId, 'COMPLETED');
          await voiceState.playConfirmation('Task marked completed deterministically without LLM.');
        } else {
          await voiceState.playConfirmation(`Direct command executed: ${result.intent || 'Query response'}`);
        }
        voiceState.setProcessingState('idle');
        return false; // Did not create review items; stayed on view
      }

      taskState.stageExtraction(result);
      if (result.tasks && result.tasks.length > 0) {
        voiceState.setProcessingState('awaiting_approval');
        await voiceState.playConfirmation(`Extracted ${result.tasks.length} action items awaiting your review.`);
        return true; // Successfully produced candidate tasks for approvals
      } else {
        voiceState.setProcessingState('idle');
        return false;
      }
    } catch (err: any) {
      voiceState.setAudioError(err.message || 'Failed to extract actionable tasks.');
      voiceState.setProcessingState('idle');
      return false; // Do not navigate on extraction error
    } finally {
      setIsExtracting(false);
    }
  }, [voiceState, taskState]);

  const value: AppStateContextValue = {
    // Workspace
    workspaceId: workspaceState.workspaceId,
    workspace: workspaceState.workspace,
    currentUser: workspaceState.currentUser,
    isWorkspaceLoading: workspaceState.isLoading,
    workspaceError: workspaceState.error,
    switchWorkspace: workspaceState.switchWorkspace,
    refetchWorkspace: workspaceState.refetchWorkspace,

    // Voice
    processingState: voiceState.processingState,
    setProcessingState: voiceState.setProcessingState,
    isRecording: voiceState.isRecording,
    recordingSeconds: voiceState.recordingSeconds,
    formattedTimer: voiceState.formattedTimer,
    audioError: voiceState.audioError,
    setAudioError: voiceState.setAudioError,
    transcript: voiceState.transcript,
    setTranscript: voiceState.setTranscript,
    wordCount: voiceState.wordCount,
    confidence: voiceState.confidence,
    detectedLanguage: voiceState.detectedLanguage,
    ttsSpokenText: voiceState.ttsSpokenText,
    setTtsSpokenText: voiceState.setTtsSpokenText,
    ttsAudioUrl: voiceState.ttsAudioUrl,
    setTtsAudioUrl: voiceState.setTtsAudioUrl,
    startRecording: voiceState.startRecording,
    stopRecording: voiceState.stopRecording,
    handleFileUpload: voiceState.handleFileUpload,
    playConfirmation: voiceState.playConfirmation,
    extractFromTranscript,
    isExtracting,

    // Tasks & Personal Task Management
    tasks: taskState.tasks,
    routines: taskState.routines,
    reminders: taskState.reminders,
    activities: taskState.activities,
    categories: taskState.categories,
    userSettings: taskState.userSettings,
    dueReminders: taskState.dueReminders,
    activeView: taskState.activeView,
    setActiveView: taskState.setActiveView,
    selectedCategory: taskState.selectedCategory,
    setSelectedCategory: taskState.setSelectedCategory,
    showArchived: taskState.showArchived,
    setShowArchived: taskState.setShowArchived,
    searchQuery: taskState.searchQuery,
    setSearchQuery: taskState.setSearchQuery,
    isTasksLoading: taskState.isLoading,
    isApproving: taskState.isApproving,
    stagedCandidates: taskState.stagedCandidates,
    extractionSummary: taskState.extractionSummary,
    ambiguities: taskState.ambiguities,
    hasCycle: taskState.hasCycle,
    cycleNodes: taskState.cycleNodes,
    tokensTelemetry: taskState.tokensTelemetry,
    updateCandidate: taskState.updateCandidate,
    approveSingleCandidate: taskState.approveSingleCandidate,
    rejectSingleCandidate: taskState.rejectSingleCandidate,
    batchApproveCandidates: taskState.batchApproveCandidates,
    discardAllCandidates: taskState.discardAllCandidates,
    createTask: taskState.createTask,
    updateTask: taskState.updateTask,
    deleteTask: taskState.deleteTask,
    updateTaskStatus: taskState.updateTaskStatus,
    toggleArchiveTask: taskState.toggleArchiveTask,
    addSubtask: taskState.addSubtask,
    updateSubtask: taskState.updateSubtask,
    toggleSubtask: taskState.toggleSubtask,
    deleteSubtask: taskState.deleteSubtask,
    createCategory: taskState.createCategory,
    updateCategory: taskState.updateCategory,
    deleteCategory: taskState.deleteCategory,
    createRoutine: taskState.createRoutine,
    updateRoutine: taskState.updateRoutine,
    deleteRoutine: taskState.deleteRoutine,
    toggleRoutineOccurrence: taskState.toggleRoutineOccurrence,
    createReminder: taskState.createReminder,
    updateReminder: taskState.updateReminder,
    cancelReminder: taskState.cancelReminder,
    deleteReminder: taskState.deleteReminder,
    updateUserSettings: taskState.updateUserSettings,
    checkDueReminders: taskState.checkDueReminders,
    refreshTasks: taskState.refreshTasks,
    refreshRoutines: taskState.refreshRoutines,
    refreshReminders: taskState.refreshReminders,
    refreshActivities: taskState.refreshActivities,

    // System
    health,
    verifyProviders,
    reducedMotion,
    setReducedMotion,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
};

export function useAppState(): AppStateContextValue {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}
