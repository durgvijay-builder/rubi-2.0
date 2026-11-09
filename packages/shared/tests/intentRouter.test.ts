import { describe, it, expect } from 'vitest';
import {
  routeIntent,
  isDirectCommand,
  normalizeTaskId,
  ZERO_TOKENS,
} from '../src/utils/intentRouter.js';

describe('Deterministic Intent Router', () => {
  describe('MARK_COMPLETED intent', () => {
    it('matches English direct command "Mark task #3 as completed."', () => {
      const result = routeIntent('Mark task #3 as completed.');
      expect(result.bypassLLM).toBe(true);
      if (result.bypassLLM) {
        expect(result.intent).toBe('MARK_COMPLETED');
        expect(result.taskId).toBe('3');
        expect(result.targetTaskId).toBe('task-seed-3');
        expect(result.tokensUsed).toEqual(ZERO_TOKENS);
      }
    });

    it('matches English direct command "Complete task #4"', () => {
      const result = routeIntent('Complete task #4');
      expect(result.bypassLLM).toBe(true);
      if (result.bypassLLM) {
        expect(result.intent).toBe('MARK_COMPLETED');
        expect(result.taskId).toBe('4');
        expect(result.targetTaskId).toBe('task-seed-4');
      }
    });

    it('matches Hinglish direct command "Task #4 ko complete kar do"', () => {
      const result = routeIntent('Task #4 ko complete kar do');
      expect(result.bypassLLM).toBe(true);
      if (result.bypassLLM) {
        expect(result.intent).toBe('MARK_COMPLETED');
        expect(result.taskId).toBe('4');
        expect(result.targetTaskId).toBe('task-seed-4');
      }
    });

    it('matches Hindi Devanagari command "टास्क नंबर 5 को पूरा मार्क करो"', () => {
      const result = routeIntent('टास्क नंबर 5 को पूरा मार्क करो');
      expect(result.bypassLLM).toBe(true);
      if (result.bypassLLM) {
        expect(result.intent).toBe('MARK_COMPLETED');
        expect(result.taskId).toBe('5');
        expect(result.targetTaskId).toBe('task-seed-5');
      }
    });

    it('preserves already-prefixed task IDs e.g. task-uuid-123', () => {
      const result = routeIntent('Mark task-prod-99 as done');
      expect(result.bypassLLM).toBe(true);
      if (result.bypassLLM) {
        expect(result.targetTaskId).toBe('task-prod-99');
      }
    });
  });

  describe('LIST_TASKS intent', () => {
    it('matches English "Show all pending tasks in the backlog."', () => {
      const result = routeIntent('Show all pending tasks in the backlog.');
      expect(result.bypassLLM).toBe(true);
      if (result.bypassLLM) {
        expect(result.intent).toBe('LIST_TASKS');
        expect(result.tokensUsed.totalTokens).toBe(0);
      }
    });

    it('matches Hinglish "Pending tasks batao"', () => {
      const result = routeIntent('Pending tasks batao');
      expect(result.bypassLLM).toBe(true);
      if (result.bypassLLM) {
        expect(result.intent).toBe('LIST_TASKS');
      }
    });

    it('matches Hindi "सभी टास्क दिखाओ"', () => {
      const result = routeIntent('सभी टास्क दिखाओ');
      expect(result.bypassLLM).toBe(true);
      if (result.bypassLLM) {
        expect(result.intent).toBe('LIST_TASKS');
      }
    });
  });

  describe('CANCEL_TASK intent', () => {
    it('matches English "Cancel task #2"', () => {
      const result = routeIntent('Cancel task #2');
      expect(result.bypassLLM).toBe(true);
      if (result.bypassLLM) {
        expect(result.intent).toBe('CANCEL_TASK');
        expect(result.taskId).toBe('2');
        expect(result.targetTaskId).toBe('task-seed-2');
      }
    });

    it('matches Hinglish "Task #2 ko cancel kar do"', () => {
      const result = routeIntent('Task #2 ko cancel kar do');
      expect(result.bypassLLM).toBe(true);
      if (result.bypassLLM) {
        expect(result.intent).toBe('CANCEL_TASK');
        expect(result.taskId).toBe('2');
      }
    });
  });

  describe('Natural conversation pass-through (No bypass)', () => {
    it('returns bypassLLM: false for conversational planning transcript', () => {
      const result = routeIntent(
        'Kal subah 10 baje sprint planning meeting karni hai aur Durgvijay ko architecture document complete karna hai before Friday.'
      );
      expect(result.bypassLLM).toBe(false);
      expect(result.intent).toBe('SEMANTIC_EXTRACTION');
    });

    it('returns bypassLLM: false for empty or whitespace transcript', () => {
      expect(routeIntent('').bypassLLM).toBe(false);
      expect(routeIntent('   ').bypassLLM).toBe(false);
      expect(routeIntent(null).bypassLLM).toBe(false);
    });

    it('isDirectCommand helper works symmetrically', () => {
      expect(isDirectCommand('Mark task #3 as completed.')).toBe(true);
      expect(isDirectCommand('Show all pending tasks in the backlog.')).toBe(true);
      expect(isDirectCommand('Schedule retrospective for Friday')).toBe(false);
    });
  });

  describe('normalizeTaskId helper', () => {
    it('prefixes numeric ID with task-seed-', () => {
      expect(normalizeTaskId('3')).toBe('task-seed-3');
    });

    it('leaves prefixed IDs untouched', () => {
      expect(normalizeTaskId('task-uuid-42')).toBe('task-uuid-42');
    });
  });
});
