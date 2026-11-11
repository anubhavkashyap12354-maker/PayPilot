export interface GeminiFunctionCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

export interface GeminiFunctionResponsePart {
  name: string;
  id?: string;
  response: Record<string, unknown>;
}

export interface GeminiContentPart {
  text?: string;
  thoughtSignature?: string;
  thought?: string;
  functionCall?: {
    id?: string;
    name: string;
    args: Record<string, unknown>;
    [key: string]: unknown;
  };
  functionResponse?: GeminiFunctionResponsePart;
  [key: string]: unknown;
}

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiContentPart[];
}

export interface GeminiGenerationResponse {
  text: string;
  functionCalls: GeminiFunctionCall[];
  candidateContent?: GeminiContent;
  rawResponse?: unknown;
}

export interface GeminiClientOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

export const DEFAULT_MODEL = "gemini-3.8-flash";
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Returns whether a live Gemini API key is configured.
 */
export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && !key.includes("your-gemini") && key.trim().length > 10);
}

/**
 * Direct REST API client for Google Gemini with function calling support.
 * Uses native fetch without external dependencies.
 */
export async function callGeminiGenerateContent(
  contents: GeminiContent[],
  tools: unknown[] = [],
  systemInstruction?: string,
  options: GeminiClientOptions = {}
): Promise<GeminiGenerationResponse> {
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY || "";
  if (!apiKey || apiKey.includes("your-gemini")) {
    throw new Error(
      "GEMINI_API_KEY is not configured in server environment (.env.local)."
    );
  }

  const model = options.model || process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs || 25_000;

  const endpoint = `${API_BASE_URL}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const requestBody: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: 2048,
    },
  };

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  if (tools && tools.length > 0) {
    requestBody.tools = [
      {
        functionDeclarations: tools,
      },
    ];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: { error?: { message?: string; status?: string } } = {};
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText } };
      }

      const msg = errorData.error?.message || `HTTP ${response.status}`;
      // Sanitize: ensure API key is never reflected in the error message
      const sanitized = msg.replace(apiKey, "[REDACTED_API_KEY]");
      throw new Error(`Gemini API Error (${response.status}): ${sanitized}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];

    if (!candidate || !candidate.content) {
      throw new Error("Gemini response did not include valid candidate content.");
    }

    const candidateContent: GeminiContent = candidate.content;
    const parts: GeminiContentPart[] = candidateContent.parts || [];
    const functionCalls: GeminiFunctionCall[] = [];
    const textPieces: string[] = [];

    for (const part of parts) {
      if (part.functionCall) {
        functionCalls.push({
          ...(part.functionCall.id ? { id: String(part.functionCall.id) } : {}),
          name: part.functionCall.name,
          args: (part.functionCall.args as Record<string, unknown>) || {},
        });
      }
      if (part.text) {
        textPieces.push(part.text);
      }
    }

    return {
      text: textPieces.join("\n").trim(),
      functionCalls,
      candidateContent,
      rawResponse: data,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        throw new Error(`Gemini API request timed out after ${timeoutMs}ms.`);
      }
      throw err;
    }
    throw new Error(String(err));
  }
}
