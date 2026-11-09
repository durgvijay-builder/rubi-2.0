/**
 * Multilingual Transcript Fixtures for R.U.B.I. 2.0 E2E Testing
 *
 * Covers English, Hindi, and Hinglish across:
 * - Single-task creation
 * - Multi-task meetings with dependencies
 * - Deterministic intent router commands (zero-token bypass)
 * - Boundary conditions (ambiguous owners, missing deadlines, circular dependencies)
 */

export interface TranscriptFixture {
  id: string;
  language: 'en' | 'hi' | 'hi-en';
  transcript: string;
  category: 'direct_command' | 'task_creation' | 'multi_task' | 'ambiguous' | 'circular_dependency' | 'query';
  description: string;
  expectedIntent?: 'MARK_COMPLETED' | 'LIST_TASKS' | 'SEMANTIC_EXTRACTION';
  expectedTaskCount?: number;
  expectedAmbiguitiesCount?: number;
}

export const TRANSCRIPT_FIXTURES: Record<string, TranscriptFixture> = {
  // English Fixtures
  EN_SINGLE_TASK: {
    id: 'en-single-task',
    language: 'en',
    transcript: 'Schedule team retrospective meeting for Friday at 4 PM and assign to Sarah.',
    category: 'task_creation',
    description: 'English single task with explicit assignee, date, and time.',
    expectedIntent: 'SEMANTIC_EXTRACTION',
    expectedTaskCount: 1,
  },
  EN_WITH_DEPENDENCY: {
    id: 'en-with-dependency',
    language: 'en',
    transcript:
      'Please set up the PostgreSQL database by tomorrow 5 PM and assign the task to backend team. The API integration is blocked by database setup.',
    category: 'multi_task',
    description: 'English two-task sequence with explicit blocking dependency relationship.',
    expectedIntent: 'SEMANTIC_EXTRACTION',
    expectedTaskCount: 2,
  },
  EN_DIRECT_COMMAND_COMPLETE: {
    id: 'en-direct-command-complete',
    language: 'en',
    transcript: 'Mark task #3 as completed.',
    category: 'direct_command',
    description: 'English deterministic command to complete task #3 (zero-token bypass).',
    expectedIntent: 'MARK_COMPLETED',
    expectedTaskCount: 0,
  },
  EN_DIRECT_COMMAND_QUERY: {
    id: 'en-direct-command-query',
    language: 'en',
    transcript: 'Show all pending tasks in the backlog.',
    category: 'query',
    description: 'English deterministic command to list pending tasks (zero-token bypass).',
    expectedIntent: 'LIST_TASKS',
    expectedTaskCount: 0,
  },
  EN_AMBIGUOUS_NO_OWNER: {
    id: 'en-ambiguous-no-owner',
    language: 'en',
    transcript: 'Fix this critical production bug as soon as possible before the release.',
    category: 'ambiguous',
    description: 'English task with missing explicit owner and ambiguous relative deadline.',
    expectedIntent: 'SEMANTIC_EXTRACTION',
    expectedTaskCount: 1,
    expectedAmbiguitiesCount: 1,
  },

  // Hindi Fixtures (Devanagari script)
  HI_TASK_CREATION: {
    id: 'hi-task-creation',
    language: 'hi',
    transcript: 'हफ्ते के अंत तक हमें डेटाबेस माइग्रेशन पूरा करना है और राहुल इसकी समीक्षा करेगा।',
    category: 'task_creation',
    description: 'Hindi task creation with assignee Rahul and deadline end of week.',
    expectedIntent: 'SEMANTIC_EXTRACTION',
    expectedTaskCount: 1,
  },
  HI_DIRECT_COMMAND_COMPLETE: {
    id: 'hi-direct-command-complete',
    language: 'hi',
    transcript: 'टास्क नंबर 5 को पूरा मार्क करो',
    category: 'direct_command',
    description: 'Hindi deterministic command to mark task 5 complete.',
    expectedIntent: 'MARK_COMPLETED',
    expectedTaskCount: 0,
  },
  HI_AMBIGUOUS_TASK: {
    id: 'hi-ambiguous-task',
    language: 'hi',
    transcript: 'इस समस्या को तुरंत हल करो',
    category: 'ambiguous',
    description: 'Hindi task without owner or exact date.',
    expectedIntent: 'SEMANTIC_EXTRACTION',
    expectedTaskCount: 1,
    expectedAmbiguitiesCount: 1,
  },

  // Hinglish Fixtures (Code-switched Hindi + English)
  HINGLISH_MULTI_TASK_MEETING: {
    id: 'hinglish-multi-task-meeting',
    language: 'hi-en',
    transcript:
      'Kal subah 10 baje sprint planning meeting karni hai aur Durgvijay ko architecture document complete karna hai before Friday. Frontend dashboard integration blocked hai backend API se.',
    category: 'multi_task',
    description:
      'Hinglish multi-party sprint planning transcript with 3 tasks and a cross-task blocking dependency.',
    expectedIntent: 'SEMANTIC_EXTRACTION',
    expectedTaskCount: 3,
  },
  HINGLISH_DIRECT_COMMAND_DONE: {
    id: 'hinglish-direct-command-done',
    language: 'hi-en',
    transcript: 'Task #4 ko complete kar do',
    category: 'direct_command',
    description: 'Hinglish deterministic status completion command (zero-token bypass).',
    expectedIntent: 'MARK_COMPLETED',
    expectedTaskCount: 0,
  },
  HINGLISH_QUERY_TASKS: {
    id: 'hinglish-query-tasks',
    language: 'hi-en',
    transcript: 'Pending tasks batao',
    category: 'query',
    description: 'Hinglish deterministic query for pending tasks.',
    expectedIntent: 'LIST_TASKS',
    expectedTaskCount: 0,
  },
  HINGLISH_AMBIGUOUS_VAGUE: {
    id: 'hinglish-ambiguous-vague',
    language: 'hi-en',
    transcript: 'Isko jaldi se fix kar do parson tak',
    category: 'ambiguous',
    description: 'Hinglish utterance with vague pronoun "isko", no assignee, and relative date "parson".',
    expectedIntent: 'SEMANTIC_EXTRACTION',
    expectedTaskCount: 1,
    expectedAmbiguitiesCount: 1,
  },

  // Boundary Fixtures
  CIRCULAR_DEPENDENCY_CASE: {
    id: 'circular-dependency-case',
    language: 'en',
    transcript: 'Task Alpha is blocked by Task Beta, and Task Beta is blocked by Task Alpha.',
    category: 'circular_dependency',
    description: 'Transcript generating a circular dependency loop (Alpha <-> Beta).',
    expectedIntent: 'SEMANTIC_EXTRACTION',
    expectedTaskCount: 2,
  },
  SELF_DEPENDENCY_CASE: {
    id: 'self-dependency-case',
    language: 'en',
    transcript: 'Task Gamma must be completed before Task Gamma can start.',
    category: 'circular_dependency',
    description: 'Self-referencing dependency where a task depends on itself.',
    expectedIntent: 'SEMANTIC_EXTRACTION',
    expectedTaskCount: 1,
  },
};

