import { NextRequest, NextResponse } from "next/server";
import { processAIChatRequest } from "@/lib/ai/orchestrator";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import { validateAIChatRequest } from "@/lib/ai/validator";
import { isGeminiConfigured, DEFAULT_MODEL } from "@/lib/ai/gemini-client";
import { PAYPILOT_AI_TOOLS } from "@/lib/ai/tools/index";

export const dynamic = "force-dynamic";

export async function GET() {
  const isLive = isGeminiConfigured();
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  return NextResponse.json(
    {
      status: "ready",
      isLiveGemini: isLive,
      engine: isLive ? `Google Gemini (${model})` : "Deterministic Tool Engine",
      toolsAvailable: Object.keys(PAYPILOT_AI_TOOLS),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    // 1. Client Identifier & Rate Limiting (30 requests/minute)
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "client-local";

    const rateLimit = checkRateLimit(clientIp, 30, 60_000);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Rate limit exceeded. Please wait ${rateLimit.resetSeconds} seconds before sending another message.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.resetSeconds),
            "X-RateLimit-Limit": String(rateLimit.limit),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // 2. Body parsing and schema validation
    const rawBody = await req.json().catch(() => null);
    const validation = validateAIChatRequest(rawBody);

    if (!validation.valid || !validation.message) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error || "Invalid request payload.",
        },
        { status: 400 }
      );
    }

    // 3. Process chat request through the AI orchestrator
    const result = await processAIChatRequest(
      validation.message,
      validation.history || [],
      { asOfDate: validation.asOfDate }
    );

    // 4. Return formatted response
    return NextResponse.json(
      {
        success: true,
        message: result.message,
        toolsExecuted: result.toolsExecuted,
        isLiveGemini: result.isLiveGemini,
        engine: result.engine,
        structuredData: result.structuredData,
      },
      {
        status: 200,
        headers: {
          "X-RateLimit-Limit": String(rateLimit.limit),
          "X-RateLimit-Remaining": String(rateLimit.remaining),
          "X-Content-Type-Options": "nosniff",
        },
      }
    );
  } catch (error) {
    console.error("[API /api/ai/chat] Unhandled error:", error);
    const message = error instanceof Error ? error.message : "Internal AI processing error.";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
