export interface TranscribeResponse {
  text: string;
  transcript?: string;
  language: string;
  confidence: number;
  durationMs?: number;
  durationSeconds?: number;
  isMock: boolean;
}

export interface SynthesizeResponse {
  audioBase64?: string;
  audioUrl?: string;
  mimeType: string;
  durationMs: number;
  durationSeconds?: number;
  spokenText: string;
  voiceUsed: string;
  isMock: boolean;
}

export interface SubtaskItem {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CandidateTask {
  tempId: string;
  title: string;
  description?: string | null | undefined;
  owner?: string | null | undefined;
  assignee?: string | null | undefined;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  effort?: 'SMALL' | 'MEDIUM' | 'LARGE' | undefined;
  slot?: string | undefined;
  categories?: string[] | undefined;
  schedule?: string | null | undefined;
  scheduledStart?: string | null | undefined;
  scheduledEnd?: string | null | undefined;
  deadline?: string | null | undefined;
  reminderTime?: string | null | undefined;
  subtasks?: Array<{ id?: string; title: string; isCompleted?: boolean; order?: number } | string> | undefined;
  dependencies: string[];
  status?: string | undefined;
  cycleError?: boolean | undefined;
  isRoutine?: boolean | undefined;
  recurrencePattern?: string | undefined;
  reminderOffsetMinutes?: number | undefined;
}

export interface ExtractResponse {
  summary: string;
  tasks: CandidateTask[];
  ambiguities: string[];
  tokensUsed: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  hasCycle?: boolean;
  cycleNodes?: string[];
  sortedOrder?: string[];
  bypassLLM?: boolean;
  intent?: string;
  affectedTaskId?: string;
}

export interface TaskItem {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  status: 'PENDING_APPROVAL' | 'TO_DO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  effort: 'SMALL' | 'MEDIUM' | 'LARGE';
  slot: string;
  categories: string[];
  schedule: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  deadline: string | null;
  reminderTime: string | null;
  assignee: string | null;
  owner?: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  dependencies: string[];
  subtasks: SubtaskItem[];
}

export interface CategoryItem {
  id: string;
  workspaceId: string;
  name: string;
  color?: string | null;
  isDefault: boolean;
}

export interface UserSettingsItem {
  id: string;
  workspaceId: string;
  timezone: string;
  defaultScheduleReminderTime?: string;
  defaultDeadlineReminderDaysBefore?: number;
  defaultDeadlineReminderTime?: string;
  customSlots?: string[];
  autoScheduleReminder?: boolean;
  autoDeadlineReminder?: boolean;
}

export interface DueReminderItem {
  id: string;
  taskId: string | null;
  taskTitle?: string;
  title?: string;
  routineId?: string | null;
  workspaceId: string;
  remindAt: string;
  message: string;
  deliveredAt: string;
  type?: string;
}

export interface ActivityItem {
  id: string;
  workspaceId: string;
  taskId: string | null;
  actorId: string | null;
  actorType: 'USER' | 'SYSTEM' | 'AI';
  eventType: string;
  description: string;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ProviderHealthDetail {
  id: 'database' | 'stt' | 'gemini' | 'tts';
  name: string;
  status: 'NOT_VERIFIED' | 'CONNECTED' | 'AUTHENTICATION_FAILED' | 'UNAVAILABLE' | 'OFFLINE_MOCK';
  isMock: boolean;
  configuredModel?: string;
  lastVerifiedAt?: string | null;
  lastFailureAt?: string | null;
  lastError?: string | null;
  errorCategory?: string | null;
  details?: string;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  mode: 'live' | 'offline' | 'auto';
  providers?: {
    database: ProviderHealthDetail;
    stt: ProviderHealthDetail;
    gemini: ProviderHealthDetail;
    tts: ProviderHealthDetail;
  };
}

export class ApiClient {
  private workspaceId: string;
  private baseUrl: string;

  constructor(workspaceId = 'workspace-rubi-primary-001', baseUrl = '') {
    this.workspaceId = workspaceId;
    this.baseUrl = baseUrl;
  }

  setWorkspaceId(id: string) {
    this.workspaceId = id;
  }

  getWorkspaceId(): string {
    return this.workspaceId;
  }

  private getHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
    return {
      'x-workspace-id': this.workspaceId,
      ...(additionalHeaders || {}),
    };
  }

  async getWorkspace(): Promise<{ workspace: any; currentUser?: any }> {
    const res = await fetch(`${this.baseUrl}/api/workspace`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to fetch workspace (HTTP ${res.status})`);
    }
    return res.json();
  }

  async transcribeAudio(fileOrBlob: Blob | File, options?: { language?: string | undefined }): Promise<TranscribeResponse> {
    const headers = this.getHeaders({
      'Content-Type': fileOrBlob.type || 'audio/wav',
    });
    if (options?.language) {
      headers['x-language'] = options.language;
    }

    const res = await fetch(`${this.baseUrl}/api/speech/transcribe`, {
      method: 'POST',
      headers,
      body: fileOrBlob,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Transcription failed with HTTP ${res.status}`);
    }

    return res.json();
  }

  async synthesizeSpeech(text: string, voice = 'en-US-Standard'): Promise<SynthesizeResponse> {
    const res = await fetch(`${this.baseUrl}/api/speech/synthesize`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ text, voice }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Speech synthesis failed with HTTP ${res.status}`);
    }

    return res.json();
  }

  async extractActions(transcript: string, context?: Record<string, unknown>): Promise<ExtractResponse> {
    const res = await fetch(`${this.baseUrl}/api/extract`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ transcript, context }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Extraction failed with HTTP ${res.status}`);
    }

    return res.json();
  }

  async extractTasks(transcript: string, context?: Record<string, unknown>): Promise<ExtractResponse> {
    return this.extractActions(transcript, context);
  }

  async getTasks(params?: {
    archived?: boolean | undefined;
    view?: string | undefined;
    category?: string | undefined;
    status?: string | undefined;
    priority?: string | undefined;
    effort?: string | undefined;
    search?: string | undefined;
  }): Promise<{ tasks: TaskItem[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.archived !== undefined) {
      query.set('archived', String(params.archived));
    }
    if (params?.view) {
      query.set('view', params.view);
    }
    if (params?.category) {
      query.set('category', params.category);
    }
    if (params?.status) {
      query.set('status', params.status);
    }
    if (params?.priority) {
      query.set('priority', params.priority);
    }
    if (params?.effort) {
      query.set('effort', params.effort);
    }
    if (params?.search) {
      query.set('search', params.search);
    }

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${this.baseUrl}/api/tasks${qs}`, {
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to fetch tasks with HTTP ${res.status}`);
    }

    return res.json();
  }

  async createTask(payload: Partial<CandidateTask>): Promise<{ success: boolean; task: TaskItem }> {
    const res = await fetch(`${this.baseUrl}/api/tasks`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to create task with HTTP ${res.status}`);
    }

    return res.json();
  }

  async approveBatch(tasks: CandidateTask[]): Promise<{ success: boolean; tasks: TaskItem[]; message?: string }> {
    const res = await fetch(`${this.baseUrl}/api/tasks/approve-all`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ tasks }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const errorObj = new Error(err.message || `Batch approval failed with HTTP ${res.status}`) as Error & { status?: number };
      errorObj.status = res.status;
      throw errorObj;
    }

    return res.json();
  }

  async approveSingle(task: CandidateTask): Promise<{ success: boolean; tasks: TaskItem[]; message?: string }> {
    const res = await fetch(`${this.baseUrl}/api/tasks/approve`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ tasks: [task] }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const errorObj = new Error(err.message || `Task approval failed with HTTP ${res.status}`) as Error & { status?: number };
      errorObj.status = res.status;
      throw errorObj;
    }

    return res.json();
  }

  async updateTask(
    taskId: string,
    patch: {
      status?: string;
      title?: string;
      description?: string | null;
      priority?: string;
      effort?: string;
      slot?: string;
      categories?: string[];
      schedule?: string | null;
      scheduledStart?: string | null;
      scheduledEnd?: string | null;
      deadline?: string | null;
      reminderTime?: string | null;
      subtasks?: Array<{ id?: string; title: string; isCompleted?: boolean; order?: number }>;
      assignee?: string | null;
      isArchived?: boolean;
    }
  ): Promise<{ success: boolean; task: TaskItem }> {
    const res = await fetch(`${this.baseUrl}/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(patch),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to update task with HTTP ${res.status}`);
    }

    return res.json();
  }

  async deleteTask(taskId: string, permanent = false): Promise<{ success: boolean; message: string }> {
    const qs = permanent ? '?permanent=true' : '';
    const res = await fetch(`${this.baseUrl}/api/tasks/${taskId}${qs}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to delete task with HTTP ${res.status}`);
    }

    return res.json();
  }

  async archiveTask(taskId: string): Promise<{ success: boolean; task: TaskItem }> {
    const res = await fetch(`${this.baseUrl}/api/tasks/${taskId}/archive`, {
      method: 'POST',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to archive task with HTTP ${res.status}`);
    }

    return res.json();
  }

  async restoreTask(taskId: string): Promise<{ success: boolean; task: TaskItem }> {
    const res = await fetch(`${this.baseUrl}/api/tasks/${taskId}/restore`, {
      method: 'POST',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to restore task with HTTP ${res.status}`);
    }

    return res.json();
  }

  async getTaskDependencies(taskId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/tasks/${taskId}/dependencies`, {
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to fetch dependencies with HTTP ${res.status}`);
    }

    return res.json();
  }

  // ── Subtask Endpoints ───────────────────────────────────────────────────────

  async addSubtask(taskId: string, title: string, order?: number): Promise<{ success: boolean; subtask: SubtaskItem }> {
    const res = await fetch(`${this.baseUrl}/api/tasks/${taskId}/subtasks`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ title, order }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to add subtask with HTTP ${res.status}`);
    }

    return res.json();
  }

  async updateSubtask(
    taskId: string,
    subtaskId: string,
    patch: { title?: string; isCompleted?: boolean; order?: number }
  ): Promise<{ success: boolean; subtask: SubtaskItem }> {
    const res = await fetch(`${this.baseUrl}/api/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: 'PATCH',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(patch),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to update subtask with HTTP ${res.status}`);
    }

    return res.json();
  }

  async deleteSubtask(taskId: string, subtaskId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${this.baseUrl}/api/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to delete subtask with HTTP ${res.status}`);
    }

    return res.json();
  }

  // ── Category Endpoints ─────────────────────────────────────────────────────

  async getCategories(): Promise<{ success: boolean; categories: CategoryItem[] }> {
    const res = await fetch(`${this.baseUrl}/api/categories`, {
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to fetch categories with HTTP ${res.status}`);
    }

    return res.json();
  }

  async createCategory(name: string, color?: string): Promise<{ success: boolean; category: CategoryItem }> {
    const res = await fetch(`${this.baseUrl}/api/categories`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name, color }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to create category with HTTP ${res.status}`);
    }

    return res.json();
  }

  async deleteCategory(categoryId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${this.baseUrl}/api/categories/${categoryId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to delete category with HTTP ${res.status}`);
    }

    return res.json();
  }

  // ── User Settings Endpoints ────────────────────────────────────────────────

  async getUserSettings(): Promise<{ success: boolean; settings: UserSettingsItem }> {
    const res = await fetch(`${this.baseUrl}/api/user-settings`, {
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to fetch user settings with HTTP ${res.status}`);
    }

    return res.json();
  }

  async updateUserSettings(patch: { timezone?: string }): Promise<{ success: boolean; settings: UserSettingsItem }> {
    const res = await fetch(`${this.baseUrl}/api/user-settings`, {
      method: 'PATCH',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(patch),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to update user settings with HTTP ${res.status}`);
    }

    return res.json();
  }

  async updateCategory(
    id: string,
    patch: { name?: string | undefined; color?: string | undefined }
  ): Promise<{ success: boolean; category: CategoryItem }> {
    const res = await fetch(`${this.baseUrl}/api/categories/${id}`, {
      method: 'PATCH',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(patch),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to update category with HTTP ${res.status}`);
    }

    return res.json();
  }

  // ── Reminders Endpoints ────────────────────────────────────────────────────

  async getReminders(filter?: {
    status?: string | undefined;
    taskId?: string | undefined;
    routineId?: string | undefined;
  }): Promise<{ success: boolean; reminders: any[] }> {
    const query = new URLSearchParams();
    if (filter?.status) query.set('status', filter.status);
    if (filter?.taskId) query.set('taskId', filter.taskId);
    if (filter?.routineId) query.set('routineId', filter.routineId);

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${this.baseUrl}/api/reminders${qs}`, {
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to fetch reminders with HTTP ${res.status}`);
    }

    return res.json();
  }

  async createReminder(data: {
    taskId?: string | null | undefined;
    routineId?: string | null | undefined;
    remindAt: string;
    message?: string | undefined;
    type?: string | undefined;
  }): Promise<{ success: boolean; reminder: any }> {
    const res = await fetch(`${this.baseUrl}/api/reminders`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to create reminder with HTTP ${res.status}`);
    }

    return res.json();
  }

  async updateReminder(
    id: string,
    patch: { remindAt?: string | undefined; message?: string | undefined; status?: string | undefined }
  ): Promise<{ success: boolean; reminder: any }> {
    const res = await fetch(`${this.baseUrl}/api/reminders/${id}`, {
      method: 'PATCH',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(patch),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to update reminder with HTTP ${res.status}`);
    }

    return res.json();
  }

  async cancelReminder(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${this.baseUrl}/api/reminders/${id}/cancel`, {
      method: 'POST',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to cancel reminder with HTTP ${res.status}`);
    }

    return res.json();
  }

  async deleteReminder(id: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/api/reminders/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to delete reminder with HTTP ${res.status}`);
    }

    return true;
  }

  // ── Routines & Recurring Habits Endpoints ──────────────────────────────────

  async getRoutines(options?: {
    isActive?: boolean | undefined;
    dateStr?: string | undefined;
  }): Promise<{ data: any[] }> {
    const query = new URLSearchParams();
    if (options?.isActive !== undefined) query.set('isActive', String(options.isActive));
    if (options?.dateStr) query.set('dateStr', options.dateStr);

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${this.baseUrl}/api/routines${qs}`, {
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to fetch routines with HTTP ${res.status}`);
    }

    return res.json();
  }

  async getRoutineById(id: string): Promise<{ data: any }> {
    const res = await fetch(`${this.baseUrl}/api/routines/${id}`, {
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to fetch routine with HTTP ${res.status}`);
    }

    return res.json();
  }

  async createRoutine(data: any): Promise<{ data: any }> {
    const res = await fetch(`${this.baseUrl}/api/routines`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to create routine with HTTP ${res.status}`);
    }

    return res.json();
  }

  async updateRoutine(id: string, patch: any): Promise<{ data: any }> {
    const res = await fetch(`${this.baseUrl}/api/routines/${id}`, {
      method: 'PATCH',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(patch),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to update routine with HTTP ${res.status}`);
    }

    return res.json();
  }

  async deleteRoutine(id: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/api/routines/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to delete routine with HTTP ${res.status}`);
    }

    return true;
  }

  async toggleRoutineOccurrence(
    id: string,
    date: string,
    status = 'COMPLETED',
    notes?: string | undefined
  ): Promise<{ data: any }> {
    const res = await fetch(`${this.baseUrl}/api/routines/${id}/occurrences`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ date, status, notes }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to toggle routine occurrence with HTTP ${res.status}`);
    }

    return res.json();
  }

  async getWeeklyOccurrences(startDate: string, endDate: string): Promise<{ data: any[] }> {
    const res = await fetch(
      `${this.baseUrl}/api/routines/occurrences/weekly?startDate=${startDate}&endDate=${endDate}`,
      {
        headers: this.getHeaders(),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to fetch weekly occurrences with HTTP ${res.status}`);
    }

    return res.json();
  }

  // ── Reminders & Push Endpoints ─────────────────────────────────────────────

  async getDueReminders(): Promise<{ success: boolean; reminders: DueReminderItem[] }> {
    const res = await fetch(`${this.baseUrl}/api/reminders/due`, {
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to fetch due reminders with HTTP ${res.status}`);
    }

    return res.json();
  }

  async subscribePush(subscription: any): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`${this.baseUrl}/api/reminders/subscribe`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(subscription),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to subscribe push with HTTP ${res.status}`);
    }

    return res.json();
  }

  // ── Activity & Health Endpoints ────────────────────────────────────────────

  async getActivities(params?: {
    taskId?: string | undefined;
    limit?: number | undefined;
  }): Promise<{ activities: ActivityItem[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.taskId) {
      query.set('taskId', params.taskId);
    }
    if (params?.limit) {
      query.set('limit', String(params.limit));
    }

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${this.baseUrl}/api/activities${qs}`, {
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to fetch activities with HTTP ${res.status}`);
    }

    return res.json();
  }

  async getHealth(): Promise<HealthResponse> {
    const res = await fetch(`${this.baseUrl}/api/health`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Health check failed with HTTP ${res.status}`);
    }
    return res.json();
  }

  async verifyProviders(): Promise<HealthResponse> {
    const res = await fetch(`${this.baseUrl}/api/health/verify-providers`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Provider verification failed with HTTP ${res.status}`);
    }
    return res.json();
  }
}

export const apiClient = new ApiClient();
