import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

describe("PayPilot Phase 3B: Server-Side AI API Route & LLM Orchestrator Tests", () => {
  let originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  // ── 1. Missing API Configuration (Graceful Fallback) ──────────────────────
  it("1. Missing API Configuration: Gracefully falls back to deterministic tool execution", async () => {
    delete process.env.GEMINI_API_KEY;
    const { processAIChatRequest } = await import(
      "../src/lib/ai/orchestrator.ts?t=" + Date.now()
    );

    const result = await processAIChatRequest("What is our revenue for this week?");
    assert.ok(result, "Result must not be null");
    assert.equal(result.isLiveGemini, false, "Must indicate non-live fallback mode");
    assert.match(result.engine, /Deterministic Tool Engine/i);
    assert.ok(result.toolsExecuted.includes("get_revenue_analytics"));
    assert.ok(result.message.text.includes("Gross Payment Volume"));
  });

  // ── 2. Tool Selection & Execution Across All 5 Domains ───────────────────
  it("2. Tool Selection: Correctly triggers each of the 5 business intelligence tools", async () => {
    delete process.env.GEMINI_API_KEY;
    const { processAIChatRequest } = await import(
      "../src/lib/ai/orchestrator.ts?t=" + Date.now()
    );

    // Overdue detector
    const overdueRes = await processAIChatRequest("Find overdue orders that are pending");
    assert.ok(overdueRes.toolsExecuted.includes("detect_overdue_orders"));
    assert.ok(overdueRes.message.text.includes("Overdue Orders Audit"));

    // Anomaly detector
    const anomalyRes = await processAIChatRequest("Check for unusual payment anomalies or decline clusters");
    assert.ok(anomalyRes.toolsExecuted.includes("detect_anomalies"));
    assert.ok(anomalyRes.message.text.includes("Payment Anomaly"));

    // Cash flow forecaster
    const cashflowRes = await processAIChatRequest("Show me the cash flow forecast for the next 7 days");
    assert.ok(cashflowRes.toolsExecuted.includes("forecast_cash_flow"));
    assert.ok(cashflowRes.message.text.includes("7-Day Cash Flow Projection"));

    // Recommendations
    const recRes = await processAIChatRequest("Give me business recommendations and priority actions");
    assert.ok(recRes.toolsExecuted.includes("get_business_recommendations"));
    assert.ok(recRes.message.text.includes("Recommendations"));
  });

  // ── 3. Gemini 3 Protocol: Multiple Tool Calls, IDs & Thought Signature Preservation
  it("3. Gemini 3 Protocol: Preserves thoughtSignature, functionCall IDs, and returns role 'user'", async () => {
    const originalFetch = globalThis.fetch;
    let callCount = 0;
    let turn2RequestBody = null;

    // Realistic Gemini 3 mock response with functionCall IDs and thoughtSignature
    globalThis.fetch = async (url, options) => {
      callCount++;
      if (callCount === 1) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: "model",
                  parts: [
                    {
                      thoughtSignature: "sig_gemini3_thought_xyz789",
                      thought: "I need to check revenue metrics and 7-day cash flow forecast.",
                    },
                    {
                      functionCall: {
                        id: "call_rev_001",
                        name: "get_revenue_analytics",
                        args: { periodDays: 7 },
                      },
                    },
                    {
                      functionCall: {
                        id: "call_cash_002",
                        name: "forecast_cash_flow",
                        args: { horizonDays: 7 },
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      } else {
        turn2RequestBody = JSON.parse(options.body);
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: "model",
                  parts: [
                    {
                      text: "Gross volume is verified and projected 7-day inflows remain strong.",
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    };

    try {
      const { processAIChatRequest } = await import(
        "../src/lib/ai/orchestrator.ts?t=" + Date.now()
      );

      const result = await processAIChatRequest(
        "Compare current revenue with 7-day projected cash flow",
        [],
        {
          geminiOptions: { apiKey: "mock_test_key_12345" },
        }
      );

      assert.equal(result.isLiveGemini, true);
      assert.ok(result.toolsExecuted.includes("get_revenue_analytics"));
      assert.ok(result.toolsExecuted.includes("forecast_cash_flow"));
      assert.equal(result.message.toolCalls?.length, 2, "Must execute both tool calls");
      assert.match(result.message.text, /Gross volume is verified/i);

      // Verify Turn 2 Conversation History Protocol
      assert.ok(turn2RequestBody, "Must have dispatched turn 2 request to Gemini");
      const contents = turn2RequestBody.contents;

      // Turn 0: User prompt
      assert.equal(contents[0].role, "user");

      // Turn 1: Model response — MUST preserve thoughtSignature and exact parts
      const modelTurn = contents[1];
      assert.equal(modelTurn.role, "model");
      assert.equal(
        modelTurn.parts[0].thoughtSignature,
        "sig_gemini3_thought_xyz789",
        "thoughtSignature must survive unmodified in conversation history"
      );
      assert.equal(modelTurn.parts[1].functionCall.id, "call_rev_001");
      assert.equal(modelTurn.parts[2].functionCall.id, "call_cash_002");

      // Turn 2: Function Responses — MUST be role 'user' (NEVER role 'function')
      const functionTurn = contents[2];
      assert.equal(
        functionTurn.role,
        "user",
        "Function response message MUST have role 'user' according to Gemini REST API protocol"
      );
      assert.notEqual(
        functionTurn.role,
        "function",
        "Must NOT use role 'function' as a Content role"
      );
      assert.equal(functionTurn.parts.length, 2, "Must return both function responses in turn 2");

      // Verify each function response matches its original call ID and name
      assert.equal(functionTurn.parts[0].functionResponse.name, "get_revenue_analytics");
      assert.equal(
        functionTurn.parts[0].functionResponse.id,
        "call_rev_001",
        "Function response 1 must preserve matching call ID"
      );
      assert.ok(functionTurn.parts[0].functionResponse.response.output);

      assert.equal(functionTurn.parts[1].functionResponse.name, "forecast_cash_flow");
      assert.equal(
        functionTurn.parts[1].functionResponse.id,
        "call_cash_002",
        "Function response 2 must preserve matching call ID"
      );
      assert.ok(functionTurn.parts[1].functionResponse.response.output);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // ── 3b. Missing / Malformed Function Call IDs Safely Handled ───────────────
  it("3b. Malformed or Missing Function Call IDs: Handles calls gracefully without ID", async () => {
    const originalFetch = globalThis.fetch;
    let turn2RequestBody = null;
    let callCount = 0;

    globalThis.fetch = async (url, options) => {
      callCount++;
      if (callCount === 1) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: "model",
                  parts: [
                    {
                      functionCall: {
                        name: "detect_overdue_orders",
                        args: { thresholdHours: 24 },
                        // Notice: id is deliberately omitted
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      } else {
        turn2RequestBody = JSON.parse(options.body);
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: "model",
                  parts: [{ text: "No overdue orders require follow-up." }],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    };

    try {
      const { processAIChatRequest } = await import(
        "../src/lib/ai/orchestrator.ts?t=" + Date.now()
      );

      const result = await processAIChatRequest("Check overdue orders", [], {
        geminiOptions: { apiKey: "mock_test_key_12345" },
      });

      assert.equal(result.isLiveGemini, true);
      assert.ok(result.toolsExecuted.includes("detect_overdue_orders"));
      assert.ok(turn2RequestBody);
      const functionTurn = turn2RequestBody.contents[2];
      assert.equal(functionTurn.role, "user");
      assert.equal(functionTurn.parts[0].functionResponse.name, "detect_overdue_orders");
      // id should simply be undefined when not present on functionCall
      assert.equal(functionTurn.parts[0].functionResponse.id, undefined);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // ── 3c. Direct Ordinary Text Responses (No Function Calls) ────────────────
  it("3c. Direct Text Responses: Handles standard conversational responses without tool calls", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    text: "I am PayPilot Copilot. How can I help with your store finances today?",
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    try {
      const { processAIChatRequest } = await import(
        "../src/lib/ai/orchestrator.ts?t=" + Date.now()
      );

      const result = await processAIChatRequest("Hello PayPilot", [], {
        geminiOptions: { apiKey: "mock_test_key_12345" },
      });

      assert.equal(result.isLiveGemini, true);
      assert.equal(result.toolsExecuted.length, 0, "No tools should be executed");
      assert.equal(
        result.message.text,
        "I am PayPilot Copilot. How can I help with your store finances today?"
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // ── 4. Maximum Tool-Call Iteration Limits ─────────────────────────────────
  it("4. Max Tool Iterations: Caps execution and terminates to prevent infinite tool-calling loops", async () => {
    const originalFetch = globalThis.fetch;
    let iterationsObserved = 0;

    // Mock Gemini repeatedly calling a tool indefinitely
    globalThis.fetch = async () => {
      iterationsObserved++;
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    functionCall: {
                      name: "get_revenue_analytics",
                      args: { periodDays: 7 },
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    try {
      const { processAIChatRequest } = await import(
        "../src/lib/ai/orchestrator.ts?t=" + Date.now()
      );

      const maxLimit = 3;
      const result = await processAIChatRequest(
        "Infinite tool test loop",
        [],
        {
          maxToolIterations: maxLimit,
          geminiOptions: { apiKey: "mock_test_key_12345" },
        }
      );

      assert.equal(
        iterationsObserved,
        maxLimit,
        `Loop must terminate after exactly ${maxLimit} iterations`
      );
      assert.ok(result.message.text.includes("completed 3 tool evaluations"));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // ── 5. Provider Errors and Timeouts ───────────────────────────────────────
  it("5. Provider Errors: Surfaces descriptive errors without leaking API keys", async () => {
    const originalFetch = globalThis.fetch;
    const testSecret = "AIzaSySecretApiKey998877";

    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          error: {
            message: `API key ${testSecret} is invalid or expired.`,
            status: "INVALID_ARGUMENT",
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    };

    try {
      const { callGeminiGenerateContent } = await import(
        "../src/lib/ai/gemini-client.ts?t=" + Date.now()
      );

      await assert.rejects(
        async () => {
          await callGeminiGenerateContent(
            [{ role: "user", parts: [{ text: "Hello" }] }],
            [],
            undefined,
            { apiKey: testSecret }
          );
        },
        (err) => {
          assert.match(err.message, /Gemini API Error \(400\)/);
          assert.doesNotMatch(
            err.message,
            new RegExp(testSecret),
            "API key must NOT be leaked in error message"
          );
          assert.match(err.message, /\[REDACTED_API_KEY\]/);
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // ── 6. Rate Limiting ──────────────────────────────────────────────────────
  it("6. Rate Limiting: Blocks requests exceeding the sliding-window threshold", async () => {
    const { checkRateLimit, resetRateLimitStore } = await import(
      "../src/lib/ai/rate-limiter.ts"
    );
    resetRateLimitStore();

    const client = "test-client-123";
    const limit = 5;

    // Send 5 permitted requests
    for (let i = 0; i < limit; i++) {
      const status = checkRateLimit(client, limit, 60_000);
      assert.equal(status.allowed, true, `Request ${i + 1} should be permitted`);
    }

    // 6th request must be rate-limited
    const blocked = checkRateLimit(client, limit, 60_000);
    assert.equal(blocked.allowed, false, "6th request must be blocked");
    assert.equal(blocked.remaining, 0);
    assert.ok(blocked.resetSeconds > 0);
  });

  // ── 7. Unauthorized Financial Mutation Guardrail ──────────────────────────
  it("7. Security Guardrail: Refuses attempts to request direct refunds, transfers or payouts", async () => {
    const { processAIChatRequest, isAttemptingFinancialMutation } = await import(
      "../src/lib/ai/orchestrator.ts?t=" + Date.now()
    );

    // Verify pattern matching
    assert.equal(
      isAttemptingFinancialMutation("Please refund order ORD-7801 immediately"),
      true
    );
    assert.equal(
      isAttemptingFinancialMutation("Disburse $500 payout to vendor account"),
      true
    );
    assert.equal(
      isAttemptingFinancialMutation("What was our refund rate this month?"),
      false
    );

    // Verify full orchestrator interception
    const result = await processAIChatRequest("Execute a refund for order ORD-7801 for $349");
    assert.equal(result.toolsExecuted.length, 0, "Must not execute any tools for financial mutations");
    assert.match(
      result.message.text,
      /Direct Mutations Prohibited|dual-control|Approvals/i,
      "Must instruct user to use the Approvals tab"
    );
  });

  // ── 8. Schema Validation & Max Prompt Length ──────────────────────────────
  it("8. Schema Validation: Enforces prompt length limits and structure", async () => {
    const { validateAIChatRequest } = await import(
      "../src/lib/ai/validator.ts"
    );

    // Test missing message
    const emptyResult = validateAIChatRequest({});
    assert.equal(emptyResult.valid, false);
    assert.match(emptyResult.error, /'message' field/i);

    // Test overly long message (>2000 chars)
    const longText = "a".repeat(2005);
    const longResult = validateAIChatRequest({ message: longText });
    assert.equal(longResult.valid, false);
    assert.match(longResult.error, /exceeds maximum allowed length/i);

    // Test invalid history structure
    const badHistoryResult = validateAIChatRequest({
      message: "Hello",
      history: [{ role: "invalid_role", content: 123 }],
    });
    assert.equal(badHistoryResult.valid, false);
    assert.match(badHistoryResult.error, /'history' must have 'role'/i);

    // Test valid request
    const validResult = validateAIChatRequest({
      message: "What is today's revenue?",
      history: [{ role: "user", content: "Hi" }],
    });
    assert.equal(validResult.valid, true);
    assert.equal(validResult.message, "What is today's revenue?");
  });

  // ── 9. Supported Model Configuration (gemini-3.8-flash) ───────────────────
  it("9. Model Configuration: Uses gemini-3.8-flash as the default model and targets correct REST endpoint", async () => {
    delete process.env.GEMINI_MODEL;
    const { DEFAULT_MODEL, callGeminiGenerateContent } = await import(
      "../src/lib/ai/gemini-client.ts?t=" + Date.now()
    );

    assert.equal(
      DEFAULT_MODEL,
      "gemini-3.8-flash",
      "Default model must be configured to gemini-3.8-flash"
    );

    let requestedUrl = "";
    let capturedBody = null;
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (url, options) => {
      requestedUrl = String(url);
      capturedBody = JSON.parse(options.body);
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Analysis completed via gemini-3.8-flash." }],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    try {
      const response = await callGeminiGenerateContent(
        [{ role: "user", parts: [{ text: "Hello" }] }],
        [],
        "System prompt",
        { apiKey: "test_key_38_flash" }
      );

      assert.match(
        requestedUrl,
        /\/models\/gemini-3\.8-flash:generateContent\?key=test_key_38_flash/,
        "Request URL must target gemini-3.8-flash:generateContent endpoint"
      );
      assert.ok(capturedBody.contents, "Request must have contents");
      assert.equal(capturedBody.systemInstruction.parts[0].text, "System prompt");
      assert.equal(response.text, "Analysis completed via gemini-3.8-flash.");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // ── 10. Repeated calls to the same tool with different arguments ───────────
  it("10. Repeated Tool Calls: Executes get_revenue_analytics twice independently with different arguments", async () => {
    const originalFetch = globalThis.fetch;
    let turn2RequestBody = null;
    let callCount = 0;

    globalThis.fetch = async (url, options) => {
      callCount++;
      if (callCount === 1) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: "model",
                  parts: [
                    {
                      functionCall: {
                        id: "call_rev_7d",
                        name: "get_revenue_analytics",
                        args: { periodDays: 7 },
                      },
                    },
                    {
                      functionCall: {
                        id: "call_rev_30d",
                        name: "get_revenue_analytics",
                        args: { periodDays: 30 },
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      } else {
        turn2RequestBody = JSON.parse(options.body);
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: "model",
                  parts: [{ text: "7-day and 30-day revenue comparison synthesized." }],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    };

    try {
      const { processAIChatRequest } = await import(
        "../src/lib/ai/orchestrator.ts?t=" + Date.now()
      );

      const result = await processAIChatRequest(
        "Compare 7-day revenue vs 30-day revenue",
        [],
        {
          geminiOptions: { apiKey: "mock_test_key_12345" },
        }
      );

      assert.equal(result.isLiveGemini, true);
      assert.ok(turn2RequestBody, "Turn 2 must be executed");
      const functionTurn = turn2RequestBody.contents[2];
      assert.equal(functionTurn.role, "user");
      assert.equal(functionTurn.parts.length, 2, "Must return 2 functionResponse parts");

      // Verify Call 1 (7 days)
      const resp1 = functionTurn.parts[0].functionResponse;
      assert.equal(resp1.name, "get_revenue_analytics");
      assert.equal(resp1.id, "call_rev_7d");
      assert.equal(resp1.response.output.periodDays, 7);

      // Verify Call 2 (30 days)
      const resp2 = functionTurn.parts[1].functionResponse;
      assert.equal(resp2.name, "get_revenue_analytics");
      assert.equal(resp2.id, "call_rev_30d");
      assert.equal(resp2.response.output.periodDays, 30);

      // Verify results are NOT overwritten (both exist independently)
      assert.notEqual(resp1.id, resp2.id);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // ── 11. Gemini 3.8 Generation Config Audit ────────────────────────────────
  it("11. Gemini 3.8 Generation Config: Omits deprecated temperature, top_p, top_k while preserving maxOutputTokens", async () => {
    let capturedBody = null;
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Generation config verified." }],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    try {
      const { callGeminiGenerateContent } = await import(
        "../src/lib/ai/gemini-client.ts?t=" + Date.now()
      );

      await callGeminiGenerateContent(
        [{ role: "user", parts: [{ text: "Hello" }] }],
        [],
        undefined,
        { apiKey: "test_key_config" }
      );

      assert.ok(capturedBody, "Request body must be captured");
      assert.ok(capturedBody.generationConfig, "Must have generationConfig");
      assert.equal(capturedBody.generationConfig.maxOutputTokens, 2048);

      // Assert deprecated parameters are NOT sent
      assert.equal(
        capturedBody.generationConfig.temperature,
        undefined,
        "temperature must be omitted under Gemini 3.8 migration guidelines"
      );
      assert.equal(
        capturedBody.generationConfig.top_p,
        undefined,
        "top_p must be omitted"
      );
      assert.equal(
        capturedBody.generationConfig.top_k,
        undefined,
        "top_k must be omitted"
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // ── 12. Safe Error Handling for Unknown/Arbitrary Function Calls ───────────
  it("12. Error Handling: Rejects unregistered function calls safely without crashing", async () => {
    const originalFetch = globalThis.fetch;
    let turn2RequestBody = null;
    let callCount = 0;

    globalThis.fetch = async (url, options) => {
      callCount++;
      if (callCount === 1) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: "model",
                  parts: [
                    {
                      functionCall: {
                        id: "call_malicious_01",
                        name: "arbitrary_unregistered_tool",
                        args: { command: "drop_database" },
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      } else {
        turn2RequestBody = JSON.parse(options.body);
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: "model",
                  parts: [{ text: "I cannot execute arbitrary tools." }],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    };

    try {
      const { processAIChatRequest } = await import(
        "../src/lib/ai/orchestrator.ts?t=" + Date.now()
      );

      const result = await processAIChatRequest("Test unauthorized tool", [], {
        geminiOptions: { apiKey: "mock_test_key_12345" },
      });

      assert.equal(result.isLiveGemini, true);
      assert.ok(turn2RequestBody);
      const functionTurn = turn2RequestBody.contents[2];
      assert.equal(functionTurn.role, "user");
      const resp = functionTurn.parts[0].functionResponse;
      assert.equal(resp.id, "call_malicious_01");
      assert.match(resp.response.output.error, /Unauthorized or unknown tool/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
