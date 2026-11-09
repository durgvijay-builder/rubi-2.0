import {
  type IExtractionAdapter,
  type ExtractedActionBatch,
  ExtractedActionBatchSchema,
} from '@rubi/shared';
import { calculateGeminiCost } from './tokenPricing.js';

export interface LiveGeminiExtractionOptions {
  apiKey?: string;
  model?: string;
  endpointUrl?: string;
  fetchFn?: typeof fetch;
}

const SYSTEM_INSTRUCTION = `You are R.U.B.I. 2.0, a voice-first personal task management AI assistant.
Your job is to extract actionable personal tasks from natural language speech or text transcripts (in English, Hindi, or Hinglish).

CRITICAL EXTRACTION GUIDELINES:
1. PERSONAL WORKLOAD: R.U.B.I. is for personal task management. Do not invent team assignees. "owner" or "assignee" should be null unless the user explicitly names another person to delegate to.
2. MULTI-SESSION SPLIT: If the user states multiple distinct times/sessions (e.g. "Schedule a machine learning session tomorrow at 5 and 7 PM"), split them into distinct individual candidate tasks (e.g. "Machine learning session (5 PM)" and "Machine learning session (7 PM)"). Do not merge them into a single task.
3. SCHEDULE VS DEADLINE:
   - "schedule" / "scheduledStart": When the user plans to perform the work (ISO 8601 UTC string or null).
   - "deadline": When the work must be finished (ISO 8601 UTC string or null).
   - Keep them independent! A task can have a schedule without a deadline, or a deadline without a schedule.
4. REMINDER TIME:
   - When the user explicitly requests a reminder ("Remind me at 5 PM", "Remind me 15 minutes before", "Remind me tomorrow morning", "Remind me 1 day before"), calculate and extract "reminderTime" as an ISO 8601 UTC timestamp.
   - If no reminder is requested, set "reminderTime": null.
5. CATEGORIES:
   - Extract an array of categories ("categories").
   - Built-in defaults: "College", "Self learning", "Side hustle", "Channel", "Ghar ka!".
   - Custom personal categories (e.g. "Placement", "Health", "Finances") are also encouraged when mentioned.
6. EFFORT LEVEL & PRIORITY:
   - "effort": "SMALL" | "MEDIUM" | "LARGE" (default "MEDIUM").
   - "priority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" (default "MEDIUM").
7. SLOT:
   - "slot": "Not decided" | "Morning" | "Afternoon" | "After College" | "Before dinner" | "After dinner" | "Night" | or custom time slot phrase.
8. SUBTASKS:
   - If the task includes checklists or steps, extract them into "subtasks": [{"title": "Checklist item", "isCompleted": false, "order": 0}].
9. RECURRING ROUTINES:
   - If the user specifies a recurring routine (e.g. "Remind me every day to exercise at 7 AM", "Daily morning cycling yaad dilana", "Every Monday check emails"), set "isRoutine": true, and "recurrencePattern": "DAILY" | "WEEKDAYS" | "WEEKENDS" | "WEEKLY".
10. REMINDERS:
   - If the user specifies an offset reminder (e.g. "Remind me 30 minutes before my machine learning session", "Is task ke 40 minutes pehle reminder laga do"), extract "reminderOffsetMinutes" (e.g. 30 or 40) and calculate "reminderTime" based on the scheduled start.
11. AMBIGUITY & TIMEZONE:
   - Use the provided Reference UTC Timestamp and User Timezone (default Asia/Kolkata) to convert relative dates ("tomorrow", "next Monday at 10 AM", "aaj raat 11 baje") into accurate ISO 8601 UTC strings.
   - If a date/time is genuinely ambiguous, add a note to "ambiguities" rather than guessing.

Output MUST be strict JSON conforming to this structure:
{
  "summary": "High-level summary of tasks",
  "tasks": [
    {
      "tempId": "task-temp-1",
      "title": "Clear action title",
      "description": "Details or notes",
      "owner": null,
      "priority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "effort": "SMALL" | "MEDIUM" | "LARGE",
      "slot": "Not decided" | "Morning" | "Afternoon" | "After College" | "Before dinner" | "After dinner" | "Night",
      "categories": ["College", "Self learning"],
      "schedule": "ISO 8601 UTC string or null",
      "scheduledStart": "ISO 8601 UTC string or null",
      "deadline": "ISO 8601 UTC string or null",
      "reminderTime": "ISO 8601 UTC string or null",
      "subtasks": [
        { "title": "Subtask title", "isCompleted": false, "order": 0 }
      ],
      "dependencies": [],
      "status": "PENDING_APPROVAL",
      "ambiguities": []
    }
  ],
  "ambiguities": []
}`;

/**
 * Live HTTP REST client for Google Gemini Structured Extraction API.
 * Uses native fetch without external heavy SDK dependencies.
 */
export class LiveGeminiExtractionAdapter implements IExtractionAdapter {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly endpointUrl: string;
  private readonly fetch: typeof fetch;

  constructor(options?: LiveGeminiExtractionOptions) {
    this.apiKey = options?.apiKey ?? process.env.GEMINI_API_KEY ?? '';
    this.model = options?.model ?? process.env.GEMINI_MODEL ?? 'gemini-flash-lite-latest';
    this.endpointUrl =
      options?.endpointUrl ??
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
    this.fetch = options?.fetchFn ?? globalThis.fetch;
  }

  async extractActions(
    transcript: string,
    _context?: Record<string, unknown>
  ): Promise<ExtractedActionBatch> {
    if (!this.apiKey) {
      throw new Error(
        'GEMINI_API_KEY is required for LiveGeminiExtractionAdapter. Set GEMINI_API_KEY environment variable or pass to constructor.'
      );
    }

    if (!transcript || transcript.trim() === '') {
      return ExtractedActionBatchSchema.parse({
        summary: 'Empty transcript',
        tasks: [],
        ambiguities: [],
        tokensUsed: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
      });
    }

    const requestUrl = this.endpointUrl.includes('key=')
      ? this.endpointUrl
      : `${this.endpointUrl}?key=${this.apiKey}`;

    const referenceIso =
      typeof _context?.referenceDate === 'string'
        ? _context.referenceDate
        : new Date().toISOString();

    const userTimezone =
      typeof _context?.timezone === 'string' ? _context.timezone : 'Asia/Kolkata';

    const requestBody = {
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Reference UTC Timestamp: ${referenceIso}\nUser Timezone: ${userTimezone}\nTranscript:\n"""\n${transcript}\n"""`,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    };

    const response = await this.fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Gemini API extraction failed with status ${response.status}: ${errorText}`
      );
    }

    const data = await response.json();
    const parts = (data?.candidates?.[0]?.content?.parts ?? []) as Array<{ text?: string }>;
    const candidateText = parts
      .map((p) => p.text ?? '')
      .join('')
      .trim();

    if (!candidateText) {
      throw new Error('Gemini API response contained no candidate text');
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(candidateText);
    } catch (parseError) {
      throw new Error(
        `Failed to parse Gemini JSON output: ${(parseError as Error).message}. Raw: ${candidateText.slice(0, 100)}`
      );
    }

    // Telemetry tokens from usageMetadata
    const promptTokens = data.usageMetadata?.promptTokenCount ?? 0;
    const completionTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
    const totalTokens = promptTokens + completionTokens;
    const estimatedCostUsd = calculateGeminiCost(promptTokens, completionTokens);

    const enriched = {
      ...(parsedJson as Record<string, unknown>),
      tokensUsed: {
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd,
      },
    };

    return ExtractedActionBatchSchema.parse(enriched);
  }
}
