export type DirectIntentType = 'MARK_COMPLETED' | 'LIST_TASKS' | 'CANCEL_TASK' | 'CANCEL_REMINDER';
export type IntentType = DirectIntentType | 'SEMANTIC_EXTRACTION';

export interface ZeroTokensUsed {
  promptTokens: 0;
  completionTokens: 0;
  totalTokens: 0;
  estimatedCostUsd: 0;
}

export const ZERO_TOKENS: ZeroTokensUsed = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  estimatedCostUsd: 0,
};

export interface MatchedIntentResult {
  bypassLLM: true;
  intent: DirectIntentType;
  taskId?: string;
  targetTaskId?: string;
  status?: string;
  message: string;
  tokensUsed: ZeroTokensUsed;
}

export interface UnmatchedIntentResult {
  bypassLLM: false;
  intent: 'SEMANTIC_EXTRACTION';
}

export type IntentRouteResult = MatchedIntentResult | UnmatchedIntentResult;

// Intent Regex matchers supporting English, Hindi, and Hinglish direct administrative commands
const COMPLETE_PATTERNS: RegExp[] = [
  // English: "Mark task #3 as completed", "Set task 3 as done", "mark #3 completed"
  /^(?:please\s+)?(?:mark|set)\s+(?:task\s+)?#?([a-zA-Z0-9_-]+)\s+(?:as\s+)?(?:done|completed|complete)$/i,
  // English: "Complete task #4", "Finish task 3" (explicit "task" required)
  /^(?:please\s+)?(?:complete|finish)\s+task\s+#?([a-zA-Z0-9_-]+)$/i,
  // Hinglish: "Task #4 ko complete kar do", "Task 3 ko done karo", "Task #4 ko done kar do"
  /^(?:task\s+)?#?([a-zA-Z0-9_-]+)\s+ko\s+(?:complete|done|khatam|pura|poora)\s*(?:kar\s*do|karo|mark\s*karo)?$/i,
  // Hindi (Devanagari): "टास्क नंबर 5 को पूरा मार्क करो", "टास्क 3 पूरा करो"
  /^(?:टास्क\s*(?:नंबर\s*)?|कार्य\s*)#?([a-zA-Z0-9_-]+)\s*(?:को\s*)?(?:पूरा\s*(?:मार्क\s*)?करो|डन\s*करो|समाप्त\s*करो)$/i,
];

const LIST_PATTERNS: RegExp[] = [
  // English: "Show all pending tasks in the backlog", "List tasks", "Read backlog"
  /^(?:please\s+)?(?:show|list|get|read|fetch|display)\s+(?:all\s+)?(?:pending\s+|active\s+)?(?:tasks|backlog|to-dos|todos)(?:\s+in\s+the\s+backlog)?$/i,
  /^(?:what\s+are\s+(?:all\s+)?my\s+tasks|view\s+backlog)$/i,
  // Hinglish: "Pending tasks batao", "sabhi tasks dikhao", "backlog dikhao"
  /^(?:pending\s+tasks?\s+batao|sabhi\s+tasks?\s+dikhao|tasks?\s+ki\s+list\s+dikhao|backlog\s+dikhao)$/i,
  // Hindi: "पेंडिंग टास्क बताओ", "सभी टास्क दिखाओ"
  /^(?:पेंडिंग\s*टास्क\s*बताओ|सभी\s*टास्क\s*दिखाओ|टास्क\s*की\s*लिस्ट\s*दिखाओ|बैकलॉग\s*दिखाओ)$/i,
];

const CANCEL_PATTERNS: RegExp[] = [
  // English: "Cancel task #2", "Discard task #2" (explicit "task" required)
  /^(?:please\s+)?(?:cancel|discard|delete|remove|drop)\s+task\s+#?([a-zA-Z0-9_-]+)$/i,
  // Hinglish: "Task #2 ko cancel kar do", "task 2 cancel karo"
  /^(?:task\s+)?#?([a-zA-Z0-9_-]+)\s*(?:ko\s*)?(?:cancel|discard|radd)\s*(?:kar\s*do|karo)$/i,
  // Hindi: "टास्क 2 को रद्द करो"
  /^(?:टास्क\s*(?:नंबर\s*)?)#?([a-zA-Z0-9_-]+)\s*(?:को\s*)?रद्द\s*करो$/i,
];

const CANCEL_REMINDER_PATTERNS: RegExp[] = [
  // English: "Cancel reminder for task #2", "Cancel reminder #3", "Discard reminder for task 1"
  /^(?:please\s+)?(?:cancel|discard|delete|remove|drop)\s+reminder\s+(?:for\s+(?:task\s+)?)?#?([a-zA-Z0-9_-]+)$/i,
  // Hinglish: "Task #2 ka reminder cancel kar do", "reminder #2 cancel karo"
  /^(?:task\s+)?#?([a-zA-Z0-9_-]+)\s*ka\s+reminder\s*(?:cancel|radd)\s*(?:kar\s*do|karo)$/i,
  /^(?:reminder\s+)?#?([a-zA-Z0-9_-]+)\s*(?:ka\s+reminder\s*)?(?:cancel|radd)\s*(?:kar\s*do|karo)$/i,
];

/**
 * Normalizes raw task id to matching format (e.g. "3" -> "task-seed-3", "task-temp-1" -> "task-temp-1").
 */
export function normalizeTaskId(rawId: string): string {
  if (rawId.startsWith('task-')) {
    return rawId;
  }
  return `task-seed-${rawId}`;
}

/**
 * Evaluates transcript against direct administrative regexes.
 * If command matches, returns zero-token bypass metadata.
 * Otherwise returns intent: 'SEMANTIC_EXTRACTION' and bypassLLM: false.
 */
export function routeIntent(transcript: string | null | undefined): IntentRouteResult {
  if (!transcript || transcript.trim() === '') {
    return {
      bypassLLM: false,
      intent: 'SEMANTIC_EXTRACTION',
    };
  }

  // Normalize: strip leading/trailing whitespace and trailing punctuation (. ! ?)
  const clean = transcript.trim().replace(/[.!?]+$/, '').trim();

  // 1. Check MARK_COMPLETED
  for (const pattern of COMPLETE_PATTERNS) {
    const match = clean.match(pattern);
    if (match && match[1]) {
      const rawId = match[1];
      const targetTaskId = normalizeTaskId(rawId);
      return {
        bypassLLM: true,
        intent: 'MARK_COMPLETED',
        taskId: rawId,
        targetTaskId,
        status: 'COMPLETED',
        message: `Task #${rawId} successfully marked as completed without LLM invocation.`,
        tokensUsed: ZERO_TOKENS,
      };
    }
  }

  // 2. Check LIST_TASKS
  for (const pattern of LIST_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        bypassLLM: true,
        intent: 'LIST_TASKS',
        message: 'Pending tasks retrieved from backlog without LLM invocation.',
        tokensUsed: ZERO_TOKENS,
      };
    }
  }

  // 3. Check CANCEL_TASK
  for (const pattern of CANCEL_PATTERNS) {
    const match = clean.match(pattern);
    if (match && match[1]) {
      const rawId = match[1];
      const targetTaskId = normalizeTaskId(rawId);
      return {
        bypassLLM: true,
        intent: 'CANCEL_TASK',
        taskId: rawId,
        targetTaskId,
        status: 'CANCELLED',
        message: `Task #${rawId} successfully cancelled without LLM invocation.`,
        tokensUsed: ZERO_TOKENS,
      };
    }
  }

  // 4. Check CANCEL_REMINDER
  for (const pattern of CANCEL_REMINDER_PATTERNS) {
    const match = clean.match(pattern);
    if (match && match[1]) {
      const rawId = match[1];
      const targetTaskId = normalizeTaskId(rawId);
      return {
        bypassLLM: true,
        intent: 'CANCEL_REMINDER',
        taskId: rawId,
        targetTaskId,
        status: 'CANCELLED',
        message: `Reminder for #${rawId} successfully cancelled without LLM invocation.`,
        tokensUsed: ZERO_TOKENS,
      };
    }
  }

  // No direct administrative match -> semantic extraction required
  return {
    bypassLLM: false,
    intent: 'SEMANTIC_EXTRACTION',
  };
}

/**
 * Helper predicate returning true if transcript can be bypassed deterministically.
 */
export function isDirectCommand(transcript: string | null | undefined): boolean {
  return routeIntent(transcript).bypassLLM;
}
