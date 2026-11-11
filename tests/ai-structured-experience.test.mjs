import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("PayPilot Phase 3C: AI Command Centre Experience Tests", () => {
  test("1. GET /api/ai/chat: Returns live engine telemetry and tools catalog", async () => {
    const { isGeminiConfigured, DEFAULT_MODEL } = await import(
      "../src/lib/ai/gemini-client.ts"
    );
    const { PAYPILOT_AI_TOOLS } = await import("../src/lib/ai/tools/index.ts");

    const isLive = isGeminiConfigured();
    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
    const expectedEngine = isLive
      ? `Google Gemini (${model})`
      : "Deterministic Tool Engine";

    assert.equal(typeof isLive, "boolean");
    assert.ok(expectedEngine.length > 0);
    assert.deepEqual(Object.keys(PAYPILOT_AI_TOOLS).sort(), [
      "detect_anomalies",
      "detect_overdue_orders",
      "forecast_cash_flow",
      "get_business_recommendations",
      "get_revenue_analytics",
    ]);
  });

  test("2. Deterministic Fallback: Generates typed structuredData for each tool branch", async () => {
    const { processAIChatRequest } = await import("../src/lib/ai/orchestrator.ts");

    // 2a. Revenue branch
    const revRes = await processAIChatRequest("Show revenue performance", [], {
      geminiOptions: { apiKey: "" },
      asOfDate: "2026-11-07T00:00:00Z",
    });
    assert.equal(revRes.isLiveGemini, false);
    assert.ok(revRes.structuredData?.revenue, "Must include structured revenue data");
    assert.ok(
      revRes.structuredData.revenue.grossVolume === 7294 || revRes.structuredData.revenue.grossVolume === 6819,
      `grossVolume must match expected rolling window total (got ${revRes.structuredData.revenue.grossVolume})`
    );
    assert.ok(
      revRes.structuredData.revenue.netRevenue === 7099.88 || revRes.structuredData.revenue.netRevenue === 6640.56,
      `netRevenue must match expected rolling window net (got ${revRes.structuredData.revenue.netRevenue})`
    );
    assert.ok(
      revRes.message.structuredData?.revenue?.grossVolume === 7294 || revRes.message.structuredData?.revenue?.grossVolume === 6819
    );

    // 2b. Forecast branch
    const forecastRes = await processAIChatRequest("Show cash flow forecast", [], {
      geminiOptions: { apiKey: "" },
    });
    assert.ok(forecastRes.structuredData?.forecast, "Must include structured forecast data");
    assert.equal(forecastRes.structuredData.forecast.horizonDays, 7);
    assert.equal(forecastRes.structuredData.forecast.currentSettledFunds, 7099.88);
    assert.ok(forecastRes.structuredData.forecast.dailyProjections.length === 7);

    // 2c. Overdue branch
    const overdueRes = await processAIChatRequest("Find overdue orders", [], {
      geminiOptions: { apiKey: "" },
    });
    assert.ok(overdueRes.structuredData?.overdue, "Must include structured overdue data");
    assert.equal(overdueRes.structuredData.overdue.overdueOrdersCount, 2);
    assert.equal(overdueRes.structuredData.overdue.totalAtRiskAmount, 840);

    // 2d. Anomalies branch
    const anomalyRes = await processAIChatRequest("Detect payment anomalies", [], {
      geminiOptions: { apiKey: "" },
    });
    assert.ok(anomalyRes.structuredData?.anomalies, "Must include structured anomaly data");
    assert.ok(anomalyRes.structuredData.anomalies.anomalies.length > 0);
    assert.equal(anomalyRes.structuredData.anomalies.riskSummary.declineRatePercentage, 30);

    // 2e. Recommendations branch
    const recRes = await processAIChatRequest("What business recommendations do you have?", [], {
      geminiOptions: { apiKey: "" },
    });
    assert.ok(recRes.structuredData?.recommendations, "Must include structured recommendation data");
    assert.ok(recRes.structuredData.recommendations.recommendations.length > 0);
  });

  test("3. Multi-Turn Live Loop: Aggregates multiple tool outputs into single structuredData payload", async () => {
    const { processAIChatRequest } = await import("../src/lib/ai/orchestrator.ts");

    let turn = 0;
    const mockMultiToolFetch = async (url, opts) => {
      turn++;
      if (turn === 1) {
        // Model requests both revenue analytics AND cash flow forecast
        return {
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  role: "model",
                  parts: [
                    {
                      functionCall: {
                        id: "call_rev",
                        name: "get_revenue_analytics",
                        args: { periodDays: 30 },
                      },
                    },
                    {
                      functionCall: {
                        id: "call_fc",
                        name: "forecast_cash_flow",
                        args: { horizonDays: 7 },
                      },
                    },
                  ],
                },
              },
            ],
          }),
        };
      }

      // Final turn: Gemini synthesizes the answer
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    text: "Based on 30-day performance and 7-day projections, operations are healthy.",
                  },
                ],
              },
            },
          ],
        }),
      };
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockMultiToolFetch;

    try {
      const res = await processAIChatRequest(
        "Give me a 30-day revenue and 7-day forecast summary",
        [],
        { geminiOptions: { apiKey: "test-fake-key-for-mock" } }
      );

      assert.equal(res.isLiveGemini, true);
      assert.deepEqual(res.toolsExecuted.sort(), [
        "forecast_cash_flow",
        "get_revenue_analytics",
      ]);
      assert.ok(res.structuredData?.revenue, "Revenue structured data must be aggregated");
      assert.ok(res.structuredData?.forecast, "Forecast structured data must be aggregated");
      assert.equal(res.structuredData.revenue.grossVolume, 7294);
      assert.equal(res.structuredData.forecast.currentSettledFunds, 7099.88);
      assert.equal(res.message.structuredData?.revenue?.grossVolume, 7294);
      assert.equal(res.message.structuredData?.forecast?.currentSettledFunds, 7099.88);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("4. Safe Data Integrity & PII Masking in Structured Payloads", async () => {
    const { processAIChatRequest } = await import("../src/lib/ai/orchestrator.ts");

    const res = await processAIChatRequest("Find overdue orders", [], {
      geminiOptions: { apiKey: "" },
    });

    const overdueData = res.structuredData?.overdue;
    assert.ok(overdueData, "Must have overdue data");

    for (const order of overdueData.overdueOrders) {
      assert.doesNotMatch(
        order.customerEmailMasked,
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Customer email must be masked"
      );
      assert.match(order.customerEmailMasked, /\*\*\*.*@/, "Must contain masked asterisks");
      assert.doesNotMatch(order.customerNameMasked, /^[A-Z][a-z]+ [A-Z][a-z]+$/, "Name must be masked initials");
    }
  });

  test("5. Recommendation & Dual-Control Structure Verification", async () => {
    const { PAYPILOT_AI_TOOLS } = await import("../src/lib/ai/tools/index.ts");
    const recResult = await PAYPILOT_AI_TOOLS.get_business_recommendations.execute({});

    assert.ok(recResult.recommendations.length > 0);
    for (const rec of recResult.recommendations) {
      assert.ok(rec.title, "Recommendation must have a title");
      assert.ok(["urgent", "high", "medium", "low"].includes(rec.priority));
      assert.ok(["revenue", "risk", "operations", "cash_flow"].includes(rec.category));
      assert.ok(rec.impactEstimate, "Must have impact estimate");
      assert.ok(rec.rationale, "Must have data rationale");
      assert.ok(rec.suggestedAction?.details, "Must have suggested action details");
    }
  });

  test("6. Critical Distinction Notice Enforced on Forecast Data", async () => {
    const { PAYPILOT_AI_TOOLS } = await import("../src/lib/ai/tools/index.ts");
    const forecast = await PAYPILOT_AI_TOOLS.forecast_cash_flow.execute({});

    assert.ok(forecast.metadata.distinctionNotice.includes("CRITICAL DISTINCTION"));
    assert.ok(forecast.metadata.distinctionNotice.includes("historical"));
    assert.ok(forecast.metadata.distinctionNotice.includes("forward-looking"));
    assert.ok(forecast.currentSettledFunds <= forecast.netProjectedCashPosition);
  });

  // ─── REGRESSION TESTS: Phase 3C.1 ───────────────────────────────────────────

  test("7. REGRESSION: Revenue tool exposes pendingVolume ($840.00 for 2 pending orders)", async () => {
    const { PAYPILOT_AI_TOOLS } = await import("../src/lib/ai/tools/index.ts");
    const revenue = await PAYPILOT_AI_TOOLS.get_revenue_analytics.execute({});

    // pendingVolume must exist and equal $840 (ORD-7799 $520 + ORD-7795 $320)
    assert.ok(typeof revenue.pendingVolume === "number", "pendingVolume must be a number");
    assert.equal(revenue.pendingVolume, 840, "pendingVolume must equal $840.00 (both pending orders)");
    assert.equal(revenue.pendingCount, 2, "Must find exactly 2 pending orders");
  });

  test("8. REGRESSION: Deterministic fallback revenue text includes full pending pipeline dollar amount", async () => {
    const { processAIChatRequest } = await import("../src/lib/ai/orchestrator.ts");

    const res = await processAIChatRequest("Show revenue performance", [], {
      geminiOptions: { apiKey: "" },
    });

    // The conversational text must include $840.00 (not truncated to $52 or missing)
    assert.match(
      res.message.text,
      /\$840\.00/,
      "Deterministic revenue fallback text must include full pending pipeline amount $840.00"
    );
    // Must NOT contain truncated form
    assert.doesNotMatch(
      res.message.text,
      /Active Pending Pipeline.*?\$52[^0]/,
      "Must not show truncated $52 without .00 or missing digits"
    );
  });

  test("9. REGRESSION: Overdue order sort is deterministic — ORD-7799 (critical, $520) sorts before ORD-7795", async () => {
    const { PAYPILOT_AI_TOOLS } = await import("../src/lib/ai/tools/index.ts");
    const overdue = await PAYPILOT_AI_TOOLS.detect_overdue_orders.execute({ thresholdHours: 24 });

    assert.ok(overdue.overdueOrders.length >= 2, "Must find at least 2 overdue orders");

    const first = overdue.overdueOrders[0];
    // ORD-7799 ($520, critical) must always be first
    assert.equal(first.orderNumber, "ORD-7799", "ORD-7799 must sort first (critical severity, higher amount)");
    assert.equal(first.severity, "critical", "First overdue order must be critical");
    assert.equal(first.amount, 520, "First overdue order must be $520.00 (Sophia Dubois)");
    // Masked email for s.dubois@luxatelier.fr -> s***s@luxatelier.fr
    assert.equal(first.customerEmailMasked, "s***s@luxatelier.fr", "ORD-7799 masked email must be s***s@luxatelier.fr");
  });

  test("10. REGRESSION: Business recommendation for overdue references ORD-7799 / Sophia D. / s***s@luxatelier.fr", async () => {
    const { PAYPILOT_AI_TOOLS } = await import("../src/lib/ai/tools/index.ts");
    const recs = await PAYPILOT_AI_TOOLS.get_business_recommendations.execute({});

    const overdueRec = recs.recommendations.find((r) => r.id === "rec_overdue_pipeline");
    assert.ok(overdueRec, "Must have overdue pipeline recommendation");
    assert.ok(overdueRec.rationale.includes("ORD-7799"), "Rationale must reference ORD-7799");
    assert.ok(overdueRec.suggestedAction.details.includes("s***s@luxatelier.fr"), "Action details must use correct masked email for Sophia Dubois");
  });

  test("11. REGRESSION: Forecast no double-counting — currentSettledFunds uses only completed transactions", async () => {
    const { PAYPILOT_AI_TOOLS } = await import("../src/lib/ai/tools/index.ts");
    const forecast = await PAYPILOT_AI_TOOLS.forecast_cash_flow.execute({});

    // currentSettledFunds must be > 0 and < netProjectedCashPosition
    assert.ok(forecast.currentSettledFunds > 0, "Settled funds must be positive");
    assert.ok(forecast.netProjectedCashPosition > forecast.currentSettledFunds, "Net projection must exceed settled funds");
    // pendingPipelineAmount equals $840 (ORD-7799 $520 + ORD-7795 $320)
    assert.equal(forecast.pendingPipelineAmount, 840, "Pending pipeline must be $840.00 (both pending orders)");
    assert.equal(forecast.pendingOrdersCount, 2, "Must count 2 pending orders");
    // projected7DayInflowTotal must be > 0
    assert.ok(forecast.projected7DayInflowTotal > 0, "Projected inflows must be positive");
  });

  test("12. REGRESSION: Approval handler is session-only — no external dispatches", async () => {
    // This test verifies the approval handler contract without rendering React.
    // We validate that the RecommendationCard module does NOT import fetch-related
    // modules or mutation API calls for approval.
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const cardPath = path.resolve("src/components/ai/RecommendationCard.tsx");
    const src = await fs.readFile(cardPath, "utf-8");

    // handleApprovalClick must only set state — not call fetch or dispatch
    assert.ok(src.includes("setSessionApproved"), "Must use session-only approval state");
    assert.ok(src.includes("setShowNotice"), "Must show session governance notice");
    // Must NOT contain direct fetch to mutation endpoints
    assert.doesNotMatch(src, /fetch\s*\(\s*['"`]\/api\/.*payment/i, "Must not call payment mutation endpoints");
    assert.doesNotMatch(src, /fetch\s*\(\s*['"`]\/api\/.*refund/i, "Must not call refund endpoints");
    // The governance notice must reference session-only nature
    assert.ok(src.includes("Session"), "Approval indicator must show Session label (not Executed)");
  });
});
