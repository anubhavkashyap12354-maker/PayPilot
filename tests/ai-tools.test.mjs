import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("PayPilot Phase 3A: AI Analytics Tools & Registry Tests", () => {
  const TEST_ANCHOR = "2026-11-07T00:00:00Z";

  // ── 1. Revenue Analytics ───────────────────────────────────────────────────
  it("1. Revenue Analytics: Computes gross volume, fees, net revenue and daily trends accurately", async () => {
    const { calculateRevenueAnalytics } = await import(
      "../src/lib/ai/tools/revenue-analytics.ts"
    );

    const result = await calculateRevenueAnalytics({
      periodDays: 7,
      asOfDate: TEST_ANCHOR,
    });

    assert.ok(result, "Result must not be null");
    assert.equal(result.currency, "USD");
    assert.ok(result.grossVolume > 0, "Gross volume must be greater than zero");
    assert.ok(result.netRevenue > 0, "Net revenue must be greater than zero");
    assert.ok(result.totalFees > 0, "Processing fees must be greater than zero");
    assert.ok(
      Math.abs(result.grossVolume - result.totalFees - result.netRevenue) < 0.05,
      "Net revenue must equal gross volume minus fees"
    );
    assert.ok(result.successfulCount > 0, "Must report successful payments count");
    assert.ok(result.averageTransactionValue > 0, "Average transaction value must be positive");
    assert.ok(result.dailyTrends.length > 0, "Must generate daily trends array");

    // Verify daily trend structure
    const firstTrend = result.dailyTrends[0];
    assert.ok(firstTrend.date, "Trend must have ISO date");
    assert.ok(firstTrend.formattedDate, "Trend must have formatted date label");
    assert.ok(typeof firstTrend.revenue === "number");
    assert.ok(typeof firstTrend.orderCount === "number");

    // Verify dataSource is properly reported
    assert.match(result.dataSource, /^(supabase|authoritative_store_memory)$/);
  });

  // ── 2. Overdue Order Detection ─────────────────────────────────────────────
  it("2. Overdue Order Detection: Identifies pending orders beyond SLA threshold with masked PII", async () => {
    const { detectOverdueOrders } = await import(
      "../src/lib/ai/tools/overdue-detector.ts"
    );

    const result = await detectOverdueOrders({
      thresholdHours: 12,
      asOfDate: TEST_ANCHOR,
    });

    assert.ok(result, "Result must not be null");
    assert.ok(result.totalOrdersScanned > 0, "Should scan store orders");
    assert.ok(result.totalPendingOrders > 0, "Should detect pending orders");
    assert.ok(result.overdueOrdersCount > 0, "Should detect orders exceeding 12h threshold");
    assert.ok(result.totalAtRiskAmount > 0, "At-risk amount must be calculated");

    const overdueItem = result.overdueOrders[0];
    assert.ok(overdueItem.orderNumber, "Must have order number");
    assert.ok(overdueItem.ageHours >= 12, "Age must be >= threshold");
    assert.match(
      overdueItem.severity,
      /^(critical|warning|info)$/,
      "Severity must be classified"
    );

    // PII Protection Checks
    assert.match(
      overdueItem.customerNameMasked,
      /^[A-Z][a-z]+ [A-Z]\.$|^Anonymous$/,
      "Customer name must be masked for privacy (e.g. 'Sophia D.')"
    );
    assert.match(
      overdueItem.customerEmailMasked,
      /\*\*\*.*@/,
      "Customer email must be masked for privacy (e.g. 's***@luxatelier.fr' or 'l***m@celtictrail.ie')"
    );
    assert.doesNotMatch(
      overdueItem.customerEmailMasked,
      /s\.dubois@luxatelier\.fr/,
      "Raw unmasked email must NOT be exposed in AI tool output"
    );
  });

  // ── 3. Anomaly Detection ───────────────────────────────────────────────────
  it("3. Anomaly Detection: Detects statistical amount outliers and failed payment clusters", async () => {
    const { detectAnomalies } = await import(
      "../src/lib/ai/tools/anomaly-detector.ts"
    );

    const result = await detectAnomalies({ zScoreThreshold: 1.5 });

    assert.ok(result, "Result must not be null");
    assert.ok(result.totalTransactionsScanned > 0, "Must scan transactions");
    assert.ok(result.anomalyCount > 0, "Must detect anomalies");

    // Verify statistical outlier detection
    const outliers = result.anomalies.filter(
      (a) => a.type === "amount_statistical_outlier"
    );
    assert.ok(outliers.length > 0, "Must detect at least one high-value statistical outlier");
    assert.ok(outliers[0].metrics?.zScore !== undefined, "Outlier must contain Z-score metric");

    // Verify failed payment clustering
    assert.ok(
      result.riskSummary.failedTransactionsCount > 0,
      "Must track failed transactions count"
    );
    assert.ok(
      result.riskSummary.declineRatePercentage > 0,
      "Must compute decline rate percentage"
    );
    assert.match(
      result.riskSummary.overallRiskScore,
      /^(low|medium|elevated)$/,
      "Risk score must be graded"
    );

    // Verify disclaimer exists (must not claim proven fraud)
    assert.match(
      result.metadata.disclaimer,
      /statistical and operational heuristics|not constitute verified fraud/i,
      "Must carry a clear disclaimer that heuristics are not proven fraud allegations"
    );
  });

  // ── 4. Cash-Flow Forecasting ───────────────────────────────────────────────
  it("4. Cash-Flow Forecasting: Projects 7-day inflows while distinguishing settled from projected funds", async () => {
    const { forecastCashFlow } = await import(
      "../src/lib/ai/tools/cashflow-forecaster.ts"
    );

    const result = await forecastCashFlow({
      horizonDays: 7,
      asOfDate: TEST_ANCHOR,
    });

    assert.ok(result, "Result must not be null");
    assert.equal(result.horizonDays, 7);
    assert.ok(result.currentSettledFunds > 0, "Must report current realized settled funds");
    assert.ok(result.pendingPipelineAmount > 0, "Must report pending pipeline volume");
    assert.ok(result.projected7DayInflowTotal > 0, "Must project 7-day inflows");
    assert.ok(
      result.netProjectedCashPosition > result.currentSettledFunds,
      "Net projected cash position must include settled plus projected inflows"
    );

    // Verify daily projections structure
    assert.equal(result.dailyProjections.length, 7, "Must project exactly 7 days");
    for (const day of result.dailyProjections) {
      assert.ok(day.date, "Day must have ISO date");
      assert.ok(day.dayLabel, "Day must have readable label");
      assert.ok(day.projectedInflow > 0, "Projected daily inflow must be positive");
      assert.ok(day.confidenceScore >= 50 && day.confidenceScore <= 100);
    }

    // Verify explicit distinction notice
    assert.match(
      result.metadata.distinctionNotice,
      /CRITICAL DISTINCTION/i,
      "Must explicitly state the distinction between historical settled funds and forward estimates"
    );
    assert.ok(result.assumptions.length >= 3, "Must document at least 3 model assumptions");
  });

  // ── 5. Business Recommendations ────────────────────────────────────────────
  it("5. Business Recommendations: Synthesizes analytics into actionable, prioritized advice", async () => {
    const { generateBusinessRecommendations } = await import(
      "../src/lib/ai/tools/business-recommendations.ts"
    );

    const result = await generateBusinessRecommendations({
      asOfDate: TEST_ANCHOR,
      category: "all",
    });

    assert.ok(result, "Result must not be null");
    assert.ok(result.totalRecommendations > 0, "Must generate recommendations");
    assert.ok(result.summaryHeadline, "Must provide an executive summary headline");

    for (const rec of result.recommendations) {
      assert.match(
        rec.category,
        /^(revenue|risk|operations|cash_flow)$/,
        "Category must be valid"
      );
      assert.match(
        rec.priority,
        /^(urgent|high|medium|low)$/,
        "Priority must be valid"
      );
      assert.ok(rec.title, "Recommendation must have a title");
      assert.ok(rec.rationale, "Recommendation must be grounded in data rationale");
      assert.ok(rec.suggestedAction.actionType, "Must provide an actionable next step");
    }

    // Test category filtering
    const opResult = await generateBusinessRecommendations({
      asOfDate: TEST_ANCHOR,
      category: "operations",
    });
    for (const r of opResult.recommendations) {
      assert.equal(r.category, "operations", "Filtered result must contain only operations category");
    }
  });

  // ── 6. Tool Registry & Gemini Declarations ──────────────────────────────────
  it("6. Tool Registry: Exposes all 5 tools and converts to valid Gemini function declarations", async () => {
    const { PAYPILOT_AI_TOOLS, getGeminiToolDeclarations } = await import(
      "../src/lib/ai/tools/index.ts"
    );

    const toolNames = Object.keys(PAYPILOT_AI_TOOLS);
    assert.ok(toolNames.includes("get_revenue_analytics"));
    assert.ok(toolNames.includes("detect_overdue_orders"));
    assert.ok(toolNames.includes("detect_anomalies"));
    assert.ok(toolNames.includes("forecast_cash_flow"));
    assert.ok(toolNames.includes("get_business_recommendations"));

    // Verify Gemini tool declarations
    const geminiDeclarations = getGeminiToolDeclarations();
    assert.equal(geminiDeclarations.length, 5);

    for (const decl of geminiDeclarations) {
      assert.ok(decl.name, "Declaration must have a name");
      assert.ok(decl.description, "Declaration must have a description");
      assert.equal(decl.parameters.type, "OBJECT", "Parameters type must be OBJECT for Gemini");
      assert.ok(
        typeof decl.parameters.properties === "object",
        "Properties must be defined"
      );
    }
  });
});
