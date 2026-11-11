import type { AIChatHistoryItem } from "./types.ts";

export interface ValidationResult {
  valid: boolean;
  message?: string;
  history?: AIChatHistoryItem[];
  asOfDate?: string;
  error?: string;
}

/**
 * Validates chat request body schema.
 */
export function validateAIChatRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid JSON payload. Request body must be an object." };
  }

  const b = body as Record<string, unknown>;

  if (typeof b.message !== "string" || b.message.trim().length === 0) {
    return { valid: false, error: "Missing or invalid 'message' field. Must be a non-empty string." };
  }

  if (b.message.length > 2000) {
    return {
      valid: false,
      error: "Prompt exceeds maximum allowed length of 2000 characters.",
    };
  }

  let history: AIChatHistoryItem[] | undefined;
  if (b.history !== undefined) {
    if (!Array.isArray(b.history)) {
      return { valid: false, error: "'history' must be an array of chat messages." };
    }
    if (b.history.length > 20) {
      return { valid: false, error: "'history' exceeds maximum length of 20 messages." };
    }
    for (const h of b.history) {
      if (
        !h ||
        typeof h !== "object" ||
        (h.role !== "user" && h.role !== "assistant") ||
        typeof h.content !== "string"
      ) {
        return {
          valid: false,
          error: "Each item in 'history' must have 'role' ('user' | 'assistant') and string 'content'.",
        };
      }
    }
    history = b.history as AIChatHistoryItem[];
  }

  let asOfDate: string | undefined;
  if (b.asOfDate !== undefined) {
    if (typeof b.asOfDate !== "string" || isNaN(Date.parse(b.asOfDate))) {
      return { valid: false, error: "'asOfDate' must be a valid ISO date string." };
    }
    asOfDate = b.asOfDate;
  }

  return {
    valid: true,
    message: b.message.trim(),
    history,
    asOfDate,
  };
}
