/**
 * Authoritative Mock Payloads & Schemas for R.U.B.I. 2.0 E2E Testing
 *
 * Derived directly from ORIGINAL_REQUEST.md, PROJECT.md, and spec_inventory.md.
 * Used by mock route handlers and assertions.
 */

export interface ExtractedTaskPayload {
  tempId: string;
  title: string;
  description?: string;
  owner: string | null;
  assignee?: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  deadline: string | null;
  targetDate?: string;
  dependencies: string[]; // tempIds of blocking tasks
  status: 'PENDING_APPROVAL' | 'TO_DO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
  ambiguities?: string[];
  cycleError?: boolean;
}

export interface ExtractedBatchPayload {
  summary: string;
  tasks: ExtractedTaskPayload[];
  ambiguities: string[];
  tokensUsed: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
}

export interface STTResponsePayload {
  text: string;
  transcript: string;
  language: string;
  confidence: number;
  durationMs: number;
  durationSeconds?: number;
  isMock: boolean;
}

export interface TTSResponsePayload {
  audioBase64: string;
  mimeType: string;
  durationMs: number;
  spokenText: string;
  voiceUsed: string;
  isMock: boolean;
}

export interface TaskRecordPayload {
  id: string;
  workspaceId: string;
  title: string;
  description?: string | null;
  status: 'PENDING_APPROVAL' | 'TO_DO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assignee: string | null;
  deadline: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  dependencies?: string[]; // IDs of tasks this task depends on
}

export interface ActivityEventPayload {
  id: string;
  workspaceId: string;
  taskId: string | null;
  actorId: string;
  actorType: 'USER' | 'SYSTEM' | 'ASSISTANT';
  eventType:
    | 'TASK_CREATED'
    | 'TASK_STATUS_CHANGED'
    | 'TASK_EDITED'
    | 'TASK_APPROVED'
    | 'TASK_REJECTED'
    | 'TASK_POSTPONED'
    | 'TASK_ARCHIVED'
    | 'TASK_RESTORED'
    | 'DEPENDENCY_ADDED'
    | 'DEPENDENCY_REMOVED'
    | 'EXTRACTION_COMPLETED'
    | 'EXTRACTION_DISCARDED';
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export const DEFAULT_WORKSPACE = {
  id: 'workspace-rubi-primary-001',
  name: 'Engineering Core',
  slug: 'engineering-core',
};

export const FOREIGN_WORKSPACE = {
  id: 'workspace-foreign-forbidden-999',
  name: 'External Org',
  slug: 'external-org',
};

export const CURRENT_USER = {
  id: 'user-durgvijay-001',
  name: 'Durgvijay Chauhan',
  role: 'ADMIN',
  workspaceId: DEFAULT_WORKSPACE.id,
};

// --- Pre-packaged Extracted Action Batches ---

export const MOCK_EXTRACTIONS: Record<string, ExtractedBatchPayload> = {
  HINGLISH_SPRINT_MEETING: {
    summary: 'Sprint planning and architecture document preparation with API dependency.',
    tasks: [
      {
        tempId: 'task-temp-1',
        title: 'Complete system architecture document',
        description: 'Prepare and finalize technical architecture before Friday.',
        owner: 'Durgvijay',
        priority: 'HIGH',
        deadline: '2026-11-13T17:00:00.000Z',
        dependencies: [],
        status: 'PENDING_APPROVAL',
      },
      {
        tempId: 'task-temp-2',
        title: 'Conduct sprint planning meeting',
        description: 'Sprint planning sync scheduled for tomorrow morning 10 AM.',
        owner: 'Team',
        priority: 'MEDIUM',
        deadline: '2026-11-08T10:00:00.000Z',
        dependencies: [],
        status: 'PENDING_APPROVAL',
      },
      {
        tempId: 'task-temp-3',
        title: 'Implement frontend dashboard integration',
        description: 'Dashboard views integration, currently blocked by backend API completion.',
        owner: 'Frontend Team',
        priority: 'MEDIUM',
        deadline: '2026-11-15T18:00:00.000Z',
        dependencies: ['task-temp-1'],
        status: 'PENDING_APPROVAL',
      },
    ],
    ambiguities: [],
    tokensUsed: {
      promptTokens: 380,
      completionTokens: 210,
      totalTokens: 590,
      estimatedCostUsd: 0.0000915,
    },
  },

  EN_DATABASE_PIPELINE: {
    summary: 'PostgreSQL setup and dependent API integration.',
    tasks: [
      {
        tempId: 'task-temp-db',
        title: 'Set up PostgreSQL database',
        description: 'Configure PostgreSQL 18 with initial migrations.',
        owner: 'Backend Team',
        priority: 'HIGH',
        deadline: '2026-11-08T17:00:00.000Z',
        dependencies: [],
        status: 'PENDING_APPROVAL',
      },
      {
        tempId: 'task-temp-api',
        title: 'Implement API integration endpoints',
        description: 'REST API controllers and service handlers connecting to database.',
        owner: 'Backend Team',
        priority: 'HIGH',
        deadline: '2026-11-09T17:00:00.000Z',
        dependencies: ['task-temp-db'],
        status: 'PENDING_APPROVAL',
      },
    ],
    ambiguities: [],
    tokensUsed: {
      promptTokens: 290,
      completionTokens: 140,
      totalTokens: 430,
      estimatedCostUsd: 0.00006375,
    },
  },

  AMBIGUOUS_NO_ASSIGNEE: {
    summary: 'Critical bugfix with unspecified owner.',
    tasks: [
      {
        tempId: 'task-temp-ambig-1',
        title: 'Fix critical production bug',
        description: 'Resolve high priority issue before the release.',
        owner: null,
        priority: 'CRITICAL',
        deadline: null,
        dependencies: [],
        status: 'PENDING_APPROVAL',
        ambiguities: ['Assignee was not specified in conversation', 'Deadline is relative or missing'],
      },
    ],
    ambiguities: ['No specific owner was assigned for the critical production bug.'],
    tokensUsed: {
      promptTokens: 210,
      completionTokens: 95,
      totalTokens: 305,
      estimatedCostUsd: 0.00004425,
    },
  },

  CIRCULAR_DEPENDENCY_CYCLE: {
    summary: 'Task Alpha and Task Beta mutually blocking each other.',
    tasks: [
      {
        tempId: 'task-temp-alpha',
        title: 'Task Alpha: Core Infrastructure',
        description: 'Infrastructure setup',
        owner: 'Dev A',
        priority: 'MEDIUM',
        deadline: '2026-11-10T12:00:00.000Z',
        dependencies: ['task-temp-beta'],
        status: 'PENDING_APPROVAL',
        cycleError: true,
      },
      {
        tempId: 'task-temp-beta',
        title: 'Task Beta: Service Client',
        description: 'Service client setup',
        owner: 'Dev B',
        priority: 'MEDIUM',
        deadline: '2026-11-10T12:00:00.000Z',
        dependencies: ['task-temp-alpha'],
        status: 'PENDING_APPROVAL',
        cycleError: true,
      },
    ],
    ambiguities: ['Circular dependency detected between Task Alpha and Task Beta.'],
    tokensUsed: {
      promptTokens: 250,
      completionTokens: 120,
      totalTokens: 370,
      estimatedCostUsd: 0.00005475,
    },
  },
};

