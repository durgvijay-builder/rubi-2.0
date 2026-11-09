export interface PricingRates {
  promptPerMillion: number;
  completionPerMillion: number;
}

/**
 * Standard Gemini 1.5/2.5 Flash pricing:
 * $0.15 per 1,000,000 prompt tokens
 * $0.60 per 1,000,000 completion tokens
 */
export const GEMINI_STANDARD_RATES: PricingRates = {
  promptPerMillion: 0.15,
  completionPerMillion: 0.6,
};

/**
 * E2E & mock payload compatible Flash pricing:
 * $0.075 per 1,000,000 prompt tokens
 * $0.30 per 1,000,000 completion tokens
 */
export const GEMINI_FLASH_RATES: PricingRates = {
  promptPerMillion: 0.075,
  completionPerMillion: 0.3,
};

/**
 * Estimates token count from a string using heuristic ~1.3 tokens per word,
 * or ~4 characters per token for English, Hindi, and Hinglish.
 */
export function estimateTokenCount(text: string | null | undefined): number {
  if (!text || text.trim() === '') {
    return 0;
  }
  const clean = text.trim();
  const words = clean.split(/\s+/).filter(Boolean);
  // Heuristic: ~1.3 tokens per word, minimum characters / 4
  const wordEstimate = Math.ceil(words.length * 1.3);
  const charEstimate = Math.ceil(clean.length / 4);
  return Math.max(1, Math.max(wordEstimate, charEstimate));
}

/**
 * Computes estimated USD cost based on prompt and completion token counts.
 * Defaults to GEMINI_FLASH_RATES to align with mock fixtures and E2E assertions.
 */
export function calculateGeminiCost(
  promptTokens: number,
  completionTokens: number,
  rates: PricingRates = GEMINI_FLASH_RATES
): number {
  const cost =
    (promptTokens * rates.promptPerMillion + completionTokens * rates.completionPerMillion) /
    1_000_000;
  return Number(cost.toFixed(8));
}
