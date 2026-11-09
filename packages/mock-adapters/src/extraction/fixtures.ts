import type { ExtractedActionBatch } from '@rubi/shared';

export interface ExtractionFixture {
  id: string;
  language: 'en' | 'hi' | 'hi-en';
  transcript: string;
  category: 'direct_command' | 'task_creation' | 'multi_task' | 'ambiguous' | 'circular_dependency' | 'query';
  description: string;
  batch: ExtractedActionBatch;
}

export const EXTRACTION_FIXTURES = {
  // 1. Hinglish Multi-task Sprint Meeting
  HINGLISH_SPRINT_MEETING: {
    id: 'hinglish-multi-task-meeting',
    language: 'hi-en',
    transcript:
      'Kal subah 10 baje sprint planning meeting karni hai aur Durgvijay ko architecture document complete karna hai before Friday. Frontend dashboard integration blocked hai backend API se.',
    category: 'multi_task',
    description: 'Hinglish multi-party sprint planning transcript with 3 tasks and a cross-task blocking dependency.',
    batch: {
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
          ambiguities: [],
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
          ambiguities: [],
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
          ambiguities: [],
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
  },

  // 2. English Two-task Database Pipeline
  EN_DATABASE_PIPELINE: {
    id: 'en-with-dependency',
    language: 'en',
    transcript:
      'Please set up the PostgreSQL database by tomorrow 5 PM and assign the task to backend team. The API integration is blocked by database setup.',
    category: 'multi_task',
    description: 'English two-task sequence with explicit blocking dependency relationship.',
    batch: {
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
          ambiguities: [],
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
          ambiguities: [],
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
  },

  // 3. English Single Task Creation
  EN_SINGLE_TASK: {
    id: 'en-single-task',
    language: 'en',
    transcript: 'Schedule team retrospective meeting for Friday at 4 PM and assign to Sarah.',
    category: 'task_creation',
    description: 'English single task with explicit assignee, date, and time.',
    batch: {
      summary: 'Team retrospective meeting scheduled for Friday.',
      tasks: [
        {
          tempId: 'task-temp-retro',
          title: 'Schedule team retrospective meeting',
          description: 'Friday at 4 PM retro',
          owner: 'Sarah',
          priority: 'MEDIUM',
          deadline: '2026-11-13T16:00:00.000Z',
          dependencies: [],
          status: 'PENDING_APPROVAL',
          ambiguities: [],
        },
      ],
      ambiguities: [],
      tokensUsed: {
        promptTokens: 180,
        completionTokens: 80,
        totalTokens: 260,
        estimatedCostUsd: 0.0000375,
      },
    },
  },

  // 4. Hindi Task Creation
  HI_TASK_CREATION: {
    id: 'hi-task-creation',
    language: 'hi',
    transcript: 'हफ्ते के अंत तक हमें डेटाबेस माइग्रेशन पूरा करना है और राहुल इसकी समीक्षा करेगा।',
    category: 'task_creation',
    description: 'Hindi task creation with assignee Rahul and deadline end of week.',
    batch: {
      summary: 'हफ्ते के अंत तक डेटाबेस माइग्रेशन और समीक्षा।',
      tasks: [
        {
          tempId: 'task-temp-hi-1',
          title: 'डेटाबेस माइग्रेशन पूरा करें',
          description: 'राहुल द्वारा समीक्षा के साथ डेटाबेस माइग्रेशन',
          owner: 'राहुल',
          priority: 'HIGH',
          deadline: '2026-11-13T17:00:00.000Z',
          dependencies: [],
          status: 'PENDING_APPROVAL',
          ambiguities: [],
        },
      ],
      ambiguities: [],
      tokensUsed: {
        promptTokens: 220,
        completionTokens: 90,
        totalTokens: 310,
        estimatedCostUsd: 0.0000435,
      },
    },
  },

  // 5. English Ambiguous No Assignee
  EN_AMBIGUOUS_NO_OWNER: {
    id: 'en-ambiguous-no-owner',
    language: 'en',
    transcript: 'Fix this critical production bug as soon as possible before the release.',
    category: 'ambiguous',
    description: 'English task with missing explicit owner and ambiguous relative deadline.',
    batch: {
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
  },

  // 6. Circular Dependency Loop (Alpha <-> Beta)
  CIRCULAR_DEPENDENCY_CYCLE: {
    id: 'circular-dependency-case',
    language: 'en',
    transcript: 'Task Alpha is blocked by Task Beta, and Task Beta is blocked by Task Alpha.',
    category: 'circular_dependency',
    description: 'Transcript generating a circular dependency loop (Alpha <-> Beta).',
    batch: {
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
          ambiguities: [],
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
          ambiguities: [],
          cycleError: true,
        },
      ],
      ambiguities: ['Circular dependency detected between Task Alpha and Task Beta.'],
      hasCycle: true,
      cycleNodes: ['Task Alpha', 'Task Beta'],
      cycleError:
        'Circular dependency detected: Task Alpha cannot depend on Task Beta while Task Beta depends on Task Alpha.',
      tokensUsed: {
        promptTokens: 250,
        completionTokens: 120,
        totalTokens: 370,
        estimatedCostUsd: 0.00005475,
      },
    },
  },

  // 7. Self-Dependency Case (Task Gamma depends on itself)
  SELF_DEPENDENCY_CASE: {
    id: 'self-dependency-case',
    language: 'en',
    transcript: 'Task Gamma must be completed before Task Gamma can start.',
    category: 'circular_dependency',
    description: 'Self-referencing dependency where a task depends on itself.',
    batch: {
      summary: 'Task Gamma with self-dependency stripped.',
      tasks: [
        {
          tempId: 'task-temp-gamma',
          title: 'Task Gamma',
          description: 'Self-referencing dependency was stripped by Zod refinement',
          owner: 'Dev Gamma',
          priority: 'MEDIUM',
          deadline: null,
          dependencies: [],
          status: 'PENDING_APPROVAL',
          ambiguities: ['Self-referencing dependency was automatically removed'],
        },
      ],
      ambiguities: ['Self-referencing dependency detected on Task Gamma and removed.'],
      tokensUsed: {
        promptTokens: 180,
        completionTokens: 80,
        totalTokens: 260,
        estimatedCostUsd: 0.0000375,
      },
    },
  },

  // 8. English Direct Command Complete
  EN_DIRECT_COMMAND_COMPLETE: {
    id: 'en-direct-command-complete',
    language: 'en',
    transcript: 'Mark task #3 as completed.',
    category: 'direct_command',
    description: 'English deterministic command to complete task #3 (zero-token bypass).',
    batch: {
      summary: 'Task #3 marked as completed.',
      tasks: [],
      ambiguities: [],
      tokensUsed: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
    },
  },

  // 9. English Direct Command Query
  EN_DIRECT_COMMAND_QUERY: {
    id: 'en-direct-command-query',
    language: 'en',
    transcript: 'Show all pending tasks in the backlog.',
    category: 'query',
    description: 'English deterministic command to list pending tasks (zero-token bypass).',
    batch: {
      summary: 'List pending tasks.',
      tasks: [],
      ambiguities: [],
      tokensUsed: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
    },
  },

  // 10. Hindi Direct Command Complete
  HI_DIRECT_COMMAND_COMPLETE: {
    id: 'hi-direct-command-complete',
    language: 'hi',
    transcript: 'टास्क नंबर 5 को पूरा मार्क करो',
    category: 'direct_command',
    description: 'Hindi deterministic command to mark task 5 complete.',
    batch: {
      summary: 'टास्क नंबर 5 पूरा किया गया।',
      tasks: [],
      ambiguities: [],
      tokensUsed: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
    },
  },

  // 11. Hindi Ambiguous Task
  HI_AMBIGUOUS_TASK: {
    id: 'hi-ambiguous-task',
    language: 'hi',
    transcript: 'इस समस्या को तुरंत हल करो',
    category: 'ambiguous',
    description: 'Hindi task without owner or exact date.',
    batch: {
      summary: 'तत्काल समस्या समाधान बिना निर्दिष्ट स्वामी।',
      tasks: [
        {
          tempId: 'task-temp-hi-ambig',
          title: 'समस्या का तत्काल समाधान',
          description: 'अनिर्दिष्ट स्वामी और समय सीमा',
          owner: null,
          priority: 'CRITICAL',
          deadline: null,
          dependencies: [],
          status: 'PENDING_APPROVAL',
          ambiguities: ['असाइन किया गया व्यक्ति निर्दिष्ट नहीं है', 'समय सीमा अस्पष्ट है'],
        },
      ],
      ambiguities: ['स्वामी निर्दिष्ट नहीं किया गया है।'],
      tokensUsed: {
        promptTokens: 190,
        completionTokens: 85,
        totalTokens: 275,
        estimatedCostUsd: 0.00003975,
      },
    },
  },

  // 12. Hinglish Direct Command Done
  HINGLISH_DIRECT_COMMAND_DONE: {
    id: 'hinglish-direct-command-done',
    language: 'hi-en',
    transcript: 'Task #4 ko complete kar do',
    category: 'direct_command',
    description: 'Hinglish deterministic status completion command (zero-token bypass).',
    batch: {
      summary: 'Task #4 completed.',
      tasks: [],
      ambiguities: [],
      tokensUsed: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
    },
  },

  // 13. Hinglish Query Tasks
  HINGLISH_QUERY_TASKS: {
    id: 'hinglish-query-tasks',
    language: 'hi-en',
    transcript: 'Pending tasks batao',
    category: 'query',
    description: 'Hinglish deterministic query for pending tasks.',
    batch: {
      summary: 'List pending tasks.',
      tasks: [],
      ambiguities: [],
      tokensUsed: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
    },
  },

  // 14. Hinglish Ambiguous Vague
  HINGLISH_AMBIGUOUS_VAGUE: {
    id: 'hinglish-ambiguous-vague',
    language: 'hi-en',
    transcript: 'Isko jaldi se fix kar do parson tak',
    category: 'ambiguous',
    description: 'Hinglish utterance with vague pronoun "isko", no assignee, and relative date "parson".',
    batch: {
      summary: 'Vague bugfix request with relative deadline.',
      tasks: [
        {
          tempId: 'task-temp-vague-1',
          title: 'Fix reported issue',
          description: 'Vague task with missing owner and relative deadline.',
          owner: null,
          priority: 'HIGH',
          deadline: '2026-11-09T17:00:00.000Z',
          dependencies: [],
          status: 'PENDING_APPROVAL',
          ambiguities: ['Assignee was not specified in conversation', 'Target entity "isko" is ambiguous'],
        },
      ],
      ambiguities: ['No specific owner assigned for the task.'],
      tokensUsed: {
        promptTokens: 200,
        completionTokens: 90,
        totalTokens: 290,
        estimatedCostUsd: 0.000042,
      },
    },
  },
} satisfies Record<string, ExtractionFixture>;
