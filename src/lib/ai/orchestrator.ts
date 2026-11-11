import type {
  AIChatHistoryItem,
  AIChatMessage,
  AIServiceResponse,
  ToolExecutionRecord,
  AIStructuredData,
} from "./types.ts";
import type { RevenueAnalyticsResult } from "./tools/revenue-analytics.ts";
import type { CashFlowForecastResult } from "./tools/cashflow-forecaster.ts";
import type { AnomalyDetectionResult } from "./tools/anomaly-detector.ts";
import type { OverdueDetectionResult } from "./tools/overdue-detector.ts";
import type { BusinessRecommendationsResult } from "./tools/business-recommendations.ts";
import {
  PAYPILOT_AI_TOOLS,
  getGeminiToolDeclarations,
} from "./tools/index.ts";
import {
  callGeminiGenerateContent,
  isGeminiConfigured,
  DEFAULT_MODEL,
  type GeminiContent,
  type GeminiClientOptions,
} from "./gemini-client.ts";

export interface OrchestratorOptions {
  maxToolIterations?: number;
  geminiOptions?: GeminiClientOptions;
  asOfDate?: string;
}

const SYSTEM_PROMPT = `You are PayPilot Copilot, an elite AI Business Payments Operations Copilot for merchant enterprises.

Your mission is to provide accurate, data-grounded financial intelligence, revenue analysis, overdue order auditing, anomaly discovery, and cash-flow forecasting.

OPERATING PRINCIPLES:
1. GROUNDED IN TRUTH: Base all answers strictly on verified facts returned by the available tools (get_revenue_analytics, detect_overdue_orders, detect_anomalies, forecast_cash_flow, get_business_recommendations). Never invent revenue, transaction amounts, dates, or customer metrics.
2. HISTORICAL VS FORECAST: Explicitly distinguish historical settled facts (actual settled transactions and revenue) from forward-looking estimates (projected inflows and pipeline conversions).
3. PRIVACY: Respect customer privacy. Never expose unmasked email addresses or full personal details. Refer to customers using masked identifiers (e.g. "Sophia D.").
4. STRICT FINANCIAL GUARDRAIL: You possess strictly READ-ONLY analytical and advisory permissions. You CANNOT execute payment captures, customer refunds, payouts, or financial ledger mutations directly. If a user asks you to refund an order, disburse funds, or charge an account, politely refuse and instruct them to submit or authorize the request through the Approvals tab under PayPilot's dual-control governance model.
5. FORMATTING: Present insights cleanly using GitHub-style Markdown: bullet points, bold key metrics, and structured tables where appropriate. Always include actionable takeaways.
6. MONETARY PRECISION: When referencing any dollar amount — including pending pipeline, revenue, fees, or forecasts — always state the full amount with exactly 2 decimal places (e.g. $840.00, $520.00). Never abbreviate, round, or truncate monetary values in conversational text.`;

const PROHIBITED_FINANCIAL_MUTATION_PATTERNS = [
  /\b(execute|issue|process|send|perform)\s+(a\s+)?(refund|chargeback|payout|disbursement|money\s+transfer)\b/i,
  /\brefund\s+(order\s+)?(ord[-_]\w+|\$\d+|\d+)/i,
  /\b(disburse|transfer|wire)\s+(\$\d+|\d+\s*usd|funds|money)/i,
  /\bcapture\s+(payment|order|funds)\s+directly\b/i,
];

/**
 * Checks whether user prompt is attempting an unauthorized direct financial mutation.
 */
export function isAttemptingFinancialMutation(prompt: string): boolean {
  return PROHIBITED_FINANCIAL_MUTATION_PATTERNS.some((pattern) =>
    pattern.test(prompt)
  );
}

const FINANCIAL_MUTATION_REFUSAL_MESSAGE = `### Dual-Control Policy Notice: Direct Mutations Prohibited

Under PayPilot's strict payment security governance:

- **AI permissions are strictly read-only:** The Copilot can analyze, detect, and recommend actions, but **cannot execute direct bank transfers, refunds, or financial payouts**.
- **Human Authorization Required:** High-value refunds, disbursements, and settlement adjustments require human dual-control sign-off.

**Recommended Next Step:**
Please navigate to the **[Approvals](/approvals)** tab to review, submit, or authorize this request with authenticated executive approval.`;

/**
 * Runs the deterministic fallback engine when GEMINI_API_KEY is not configured.
 * Executes the exact same server tools to produce authentic, data-backed insights.
 */
async function runDeterministicFallback(
  prompt: string,
  asOfDate?: string
): Promise<AIServiceResponse> {
  const normalized = prompt.toLowerCase();
  const timestamp = new Date().toISOString();
  const executedRecords: ToolExecutionRecord[] = [];
  const toolsExecuted: string[] = [];

  // Check mutation guardrail first
  if (isAttemptingFinancialMutation(prompt)) {
    return {
      isLiveGemini: false,
      engine: "Deterministic Tool Engine (Policy Guardrail)",
      toolsExecuted: [],
      message: {
        id: `msg_${Date.now()}`,
        sender: "assistant",
        text: FINANCIAL_MUTATION_REFUSAL_MESSAGE,
        timestamp,
        suggestions: ["Review pending approvals", "Analyse today's revenue"],
        isDemoSample: false,
      },
    };
  }

  // 1. Overdue / At-risk / Delayed Orders
  if (
    normalized.includes("overdue") ||
    normalized.includes("pending") ||
    normalized.includes("follow up") ||
    normalized.includes("follow-up") ||
    normalized.includes("stalled")
  ) {
    const overdueResult = await PAYPILOT_AI_TOOLS.detect_overdue_orders.execute({
      asOfDate,
      thresholdHours: 24,
    });
    toolsExecuted.push("detect_overdue_orders");
    executedRecords.push({
      toolName: "detect_overdue_orders",
      arguments: { thresholdHours: 24, asOfDate },
      resultSummary: `Found ${overdueResult.overdueOrdersCount} overdue orders ($${overdueResult.totalAtRiskAmount.toFixed(2)} at risk)`,
      executedAt: timestamp,
    });

    let text = `### Overdue Orders Audit (Verified Store Data)\n\n`;
    text += `Scanned **${overdueResult.totalOrdersScanned} orders** with a 24-hour SLA threshold.\n\n`;
    text += `- **Overdue Pending Orders:** ${overdueResult.overdueOrdersCount}\n`;
    text += `- **Total Volume at Risk:** $${overdueResult.totalAtRiskAmount.toFixed(2)} ${overdueResult.currency}\n\n`;

    if (overdueResult.overdueOrders.length > 0) {
      text += `#### Orders Requiring Attention:\n`;
      for (const order of overdueResult.overdueOrders.slice(0, 3)) {
        text += `- **${order.orderNumber}** (${order.customerNameMasked}): **$${order.amount.toFixed(2)}** — Pending for **${order.ageHours} hours** (${order.severity.toUpperCase()})\n`;
        text += `  *Reason:* ${order.reason}\n`;
        text += `  *Suggested Action:* ${order.suggestedAction}\n`;
      }
    } else {
      text += `All pending orders are within normal processing SLAs. No immediate customer follow-ups required.\n`;
    }

    const structuredData: AIStructuredData = { overdue: overdueResult };
    return {
      isLiveGemini: false,
      engine: "Deterministic Tool Engine (No API key set)",
      toolsExecuted,
      structuredData,
      message: {
        id: `msg_${Date.now()}`,
        sender: "assistant",
        text,
        timestamp,
        toolCalls: executedRecords,
        suggestions: [
          "What anomalies have been detected?",
          "Show 7-day cash flow forecast",
          "What recommendations do you have?",
        ],
        isDemoSample: false,
        structuredData,
      },
    };
  }

  // 2. Anomalies / Declines / Fraud / Unusual
  if (
    normalized.includes("anomal") ||
    normalized.includes("unusual") ||
    normalized.includes("fraud") ||
    normalized.includes("failed") ||
    normalized.includes("decline") ||
    normalized.includes("risk")
  ) {
    const anomalyResult = await PAYPILOT_AI_TOOLS.detect_anomalies.execute({
      sensitivity: "standard",
    });
    toolsExecuted.push("detect_anomalies");
    executedRecords.push({
      toolName: "detect_anomalies",
      arguments: { sensitivity: "standard" },
      resultSummary: `Found ${anomalyResult.anomalyCount} anomalies (Decline rate: ${anomalyResult.riskSummary.declineRatePercentage}%)`,
      executedAt: timestamp,
    });

    let text = `### Payment Anomaly & Risk Report\n\n`;
    text += `Analyzed **${anomalyResult.totalTransactionsScanned} store transactions** using Z-score statistical modeling and failure clustering:\n\n`;
    text += `- **Overall Risk Assessment:** **${anomalyResult.riskSummary.overallRiskScore.toUpperCase()}**\n`;
    text += `- **Transaction Decline Rate:** ${anomalyResult.riskSummary.declineRatePercentage}%\n`;
    text += `- **High-Value Amount Outliers ($Z \\ge 2.0\\sigma$):** ${anomalyResult.riskSummary.highValueOutliersCount}\n`;
    text += `- **Declined Payment Count:** ${anomalyResult.riskSummary.failedTransactionsCount}\n\n`;

    if (anomalyResult.anomalies.length > 0) {
      text += `#### Key Observations:\n`;
      for (const item of anomalyResult.anomalies.slice(0, 3)) {
        text += `- **${item.title}** (${item.severity.toUpperCase()}):\n  ${item.explanation}\n`;
      }
    }

    text += `\n> **Notice:** *${anomalyResult.metadata.disclaimer}*`;

    const structuredData: AIStructuredData = { anomalies: anomalyResult };
    return {
      isLiveGemini: false,
      engine: "Deterministic Tool Engine (No API key set)",
      toolsExecuted,
      structuredData,
      message: {
        id: `msg_${Date.now()}`,
        sender: "assistant",
        text,
        timestamp,
        toolCalls: executedRecords,
        suggestions: [
          "Show revenue performance",
          "Check overdue orders",
          "What actions should we take?",
        ],
        isDemoSample: false,
        structuredData,
      },
    };
  }

  // 3. Cash Flow / Forecasting / Projections
  if (
    normalized.includes("cash flow") ||
    normalized.includes("cashflow") ||
    normalized.includes("forecast") ||
    normalized.includes("projection") ||
    normalized.includes("inflow")
  ) {
    const forecastResult = await PAYPILOT_AI_TOOLS.forecast_cash_flow.execute({
      asOfDate,
      horizonDays: 7,
    });
    toolsExecuted.push("forecast_cash_flow");
    executedRecords.push({
      toolName: "forecast_cash_flow",
      arguments: { horizonDays: 7, asOfDate },
      resultSummary: `Projected 7-day inflows: $${forecastResult.projected7DayInflowTotal.toFixed(2)}`,
      executedAt: timestamp,
    });

    let text = `### 7-Day Cash Flow Projection\n\n`;
    text += `Synthesized trailing transaction velocity with active pending order realization:\n\n`;
    text += `- **Currently Settled Realized Funds:** **$${forecastResult.currentSettledFunds.toLocaleString("en-US", { minimumFractionDigits: 2 })}**\n`;
    text += `- **Pending Order Pipeline:** $${forecastResult.pendingPipelineAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} across ${forecastResult.pendingOrdersCount} orders\n`;
    text += `- **Projected 7-Day Forward Inflows:** **$${forecastResult.projected7DayInflowTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}**\n`;
    text += `- **Net Projected Cash Position:** **$${forecastResult.netProjectedCashPosition.toLocaleString("en-US", { minimumFractionDigits: 2 })}** (Confidence: ${forecastResult.overallConfidenceScore}%)\n\n`;

    text += `#### Forward Daily Forecast:\n`;
    text += `| Date | Projected Inflow | Scheduled Clearing | Model Confidence |\n`;
    text += `| :--- | :--- | :--- | :--- |\n`;
    for (const day of forecastResult.dailyProjections.slice(0, 5)) {
      text += `| ${day.dayLabel} | $${day.projectedInflow.toFixed(2)} | $${day.settledCarryover.toFixed(2)} (T+1) | ${day.confidenceScore}% |\n`;
    }

    text += `\n*${forecastResult.metadata.distinctionNotice}*`;

    const structuredData: AIStructuredData = { forecast: forecastResult };
    return {
      isLiveGemini: false,
      engine: "Deterministic Tool Engine (No API key set)",
      toolsExecuted,
      structuredData,
      message: {
        id: `msg_${Date.now()}`,
        sender: "assistant",
        text,
        timestamp,
        toolCalls: executedRecords,
        suggestions: [
          "Give me business recommendations",
          "Analyse today's revenue",
          "Check overdue orders",
        ],
        isDemoSample: false,
        structuredData,
      },
    };
  }

  // 4. Recommendations / Action Items / Strategy
  if (
    normalized.includes("recommend") ||
    normalized.includes("advice") ||
    normalized.includes("strategy") ||
    normalized.includes("action") ||
    normalized.includes("priorit")
  ) {
    const recResult = await PAYPILOT_AI_TOOLS.get_business_recommendations.execute({
      asOfDate,
      category: "all",
    });
    toolsExecuted.push("get_business_recommendations");
    executedRecords.push({
      toolName: "get_business_recommendations",
      arguments: { category: "all", asOfDate },
      resultSummary: `Generated ${recResult.totalRecommendations} prioritized recommendations`,
      executedAt: timestamp,
    });

    let text = `### AI Strategic Business Recommendations\n\n`;
    text += `**Executive Headline:** ${recResult.summaryHeadline}\n\n`;

    for (let i = 0; i < recResult.recommendations.length; i++) {
      const rec = recResult.recommendations[i];
      text += `#### ${i + 1}. [${rec.priority.toUpperCase()}] ${rec.title}\n`;
      text += `- **Category:** \`${rec.category}\`\n`;
      text += `- **Estimated Impact:** ${rec.impactEstimate}\n`;
      text += `- **Data Rationale:** ${rec.rationale}\n`;
      text += `- **Action Item:** ${rec.suggestedAction.details}\n\n`;
    }

    const structuredData: AIStructuredData = { recommendations: recResult };
    return {
      isLiveGemini: false,
      engine: "Deterministic Tool Engine (No API key set)",
      toolsExecuted,
      structuredData,
      message: {
        id: `msg_${Date.now()}`,
        sender: "assistant",
        text,
        timestamp,
        toolCalls: executedRecords,
        suggestions: [
          "Show revenue performance",
          "Show 7-day cash flow forecast",
          "Check overdue orders",
        ],
        isDemoSample: false,
        structuredData,
      },
    };
  }

  // 5. Default / Revenue Analytics
  const revenueResult = await PAYPILOT_AI_TOOLS.get_revenue_analytics.execute({
    asOfDate,
    periodDays: 7,
  });
  toolsExecuted.push("get_revenue_analytics");
  executedRecords.push({
    toolName: "get_revenue_analytics",
    arguments: { periodDays: 7, asOfDate },
    resultSummary: `Gross volume: $${revenueResult.grossVolume.toFixed(2)}, Net: $${revenueResult.netRevenue.toFixed(2)}`,
    executedAt: timestamp,
  });

  let text = `### Verified Store Revenue Analytics\n\n`;
  text += `Authoritative store metrics for the last **${revenueResult.periodDays} days** (data source: \`${revenueResult.dataSource}\`):\n\n`;
  text += `- **Gross Payment Volume:** **$${revenueResult.grossVolume.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${revenueResult.currency}**\n`;
  text += `- **Net Revenue (After Fees):** **$${revenueResult.netRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}**\n`;
  text += `- **Total Processing Fees:** $${revenueResult.totalFees.toFixed(2)}\n`;
  text += `- **Successful Payments:** ${revenueResult.successfulCount} (${revenueResult.successRate}% conversion)\n`;
  text += `- **Average Ticket Size:** $${revenueResult.averageTransactionValue.toFixed(2)}\n`;
  text += `- **Active Pending Pipeline:** ${revenueResult.pendingCount} order(s) totaling **$${revenueResult.pendingVolume.toFixed(2)}** awaiting payment completion\n`;
  if (revenueResult.growthRate !== null) {
    text += `- **Growth Rate:** ${revenueResult.growthRate >= 0 ? "+" : ""}${revenueResult.growthRate}% vs prior period\n`;
  }

  const structuredData: AIStructuredData = { revenue: revenueResult };
  return {
    isLiveGemini: false,
    engine: "Deterministic Tool Engine (No API key set)",
    toolsExecuted,
    structuredData,
    message: {
      id: `msg_${Date.now()}`,
      sender: "assistant",
      text,
      timestamp,
      toolCalls: executedRecords,
      suggestions: [
        "Find overdue orders requiring follow-up",
        "Detect payment anomalies",
        "Show 7-day cash flow forecast",
        "What recommendations do you have?",
      ],
      isDemoSample: false,
      structuredData,
    },
  };
}

/**
 * Main server-side AI orchestrator function.
 * Evaluates live Gemini credentials:
 *   - If configured: executes multi-turn tool-calling loop via Gemini 2.0 / 1.5.
 *   - If unconfigured: executes authoritative tools via the deterministic fallback engine.
 */
export async function processAIChatRequest(
  prompt: string,
  history: AIChatHistoryItem[] = [],
  options: OrchestratorOptions = {}
): Promise<AIServiceResponse> {
  const maxIterations = options.maxToolIterations ?? 5;
  const asOfDate = options.asOfDate;
  const timestamp = new Date().toISOString();

  // 1. Guardrail against unauthorized financial mutations
  if (isAttemptingFinancialMutation(prompt)) {
    return {
      isLiveGemini: false,
      engine: "PayPilot Security Guardrail",
      toolsExecuted: [],
      message: {
        id: `msg_${Date.now()}`,
        sender: "assistant",
        text: FINANCIAL_MUTATION_REFUSAL_MESSAGE,
        timestamp,
        suggestions: ["Review pending approvals", "Analyse today's revenue"],
        isDemoSample: false,
      },
    };
  }

  // 2. If Gemini is not configured, run deterministic fallback engine
  if (!isGeminiConfigured() && !options.geminiOptions?.apiKey) {
    return await runDeterministicFallback(prompt, asOfDate);
  }

  // 3. Prepare Gemini conversation contents with history
  const contents: GeminiContent[] = [];

  for (const item of history.slice(-10)) {
    contents.push({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }],
    });
  }

  // Append user's current query
  contents.push({
    role: "user",
    parts: [{ text: prompt }],
  });

  const toolDeclarations = getGeminiToolDeclarations();
  const executedRecords: ToolExecutionRecord[] = [];
  const toolsExecutedNames = new Set<string>();
  const structuredData: AIStructuredData = {};

  let iteration = 0;
  let finalAssistantText = "";

  // 4. Multi-turn Agent Tool-Calling Loop (capped at maxIterations to prevent infinite loops)
  while (iteration < maxIterations) {
    iteration++;

    const response = await callGeminiGenerateContent(
      contents,
      toolDeclarations,
      SYSTEM_PROMPT,
      options.geminiOptions
    );

    // If Gemini did not call any tools, we have our final text answer
    if (!response.functionCalls || response.functionCalls.length === 0) {
      finalAssistantText = response.text || "I have analyzed your request based on current store records.";
      break;
    }

    // 1. Preserve original model turn in conversation history byte-for-byte
    // (Preserves thoughtSignature, function call IDs, and arbitrary model parts)
    if (response.candidateContent) {
      contents.push(response.candidateContent);
    } else {
      contents.push({
        role: "model",
        parts: response.functionCalls.map((fc) => ({
          functionCall: {
            ...(fc.id ? { id: fc.id } : {}),
            name: fc.name,
            args: fc.args,
          },
        })),
      });
    }

    // Execute each tool requested by Gemini
    const toolResponseParts: {
      functionResponse: {
        name: string;
        id?: string;
        response: Record<string, unknown>;
      };
    }[] = [];

    for (const fc of response.functionCalls) {
      toolsExecutedNames.add(fc.name);
      // Security verification: strictly execute only registered tools in PAYPILOT_AI_TOOLS
      const isRegisteredTool =
        typeof fc.name === "string" &&
        Object.prototype.hasOwnProperty.call(PAYPILOT_AI_TOOLS, fc.name);
      const toolDef = isRegisteredTool ? PAYPILOT_AI_TOOLS[fc.name] : undefined;

      let toolOutput: unknown;

      if (!toolDef) {
        toolOutput = { error: `Unauthorized or unknown tool '${String(fc.name)}'. Execution refused.` };
      } else {
        try {
          const toolArgs =
            typeof fc.args === "object" && fc.args !== null ? { ...fc.args } : {};
          if (asOfDate && !toolArgs.asOfDate) {
            toolArgs.asOfDate = asOfDate;
          }
          toolOutput = await toolDef.execute(toolArgs);

          // Populate typed structured data safely
          if (fc.name === "get_revenue_analytics") {
            structuredData.revenue = toolOutput as RevenueAnalyticsResult;
          } else if (fc.name === "forecast_cash_flow") {
            structuredData.forecast = toolOutput as CashFlowForecastResult;
          } else if (fc.name === "detect_anomalies") {
            structuredData.anomalies = toolOutput as AnomalyDetectionResult;
          } else if (fc.name === "detect_overdue_orders") {
            structuredData.overdue = toolOutput as OverdueDetectionResult;
          } else if (fc.name === "get_business_recommendations") {
            structuredData.recommendations = toolOutput as BusinessRecommendationsResult;
          }
        } catch (err) {
          toolOutput = {
            error: `Failed to execute tool '${fc.name}': ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }

      const isSuccessfulTool =
        typeof toolOutput === "object" && toolOutput !== null && !("error" in (toolOutput as Record<string, unknown>));

      executedRecords.push({
        toolName: fc.name,
        arguments: fc.args,
        resultSummary: typeof toolOutput === "object" && toolOutput !== null ? JSON.stringify(toolOutput).slice(0, 150) + "..." : String(toolOutput),
        executedAt: new Date().toISOString(),
        safeData: isSuccessfulTool ? (toolOutput as Record<string, unknown>) : undefined,
      });

      const functionResponseObj: {
        name: string;
        id?: string;
        response: Record<string, unknown>;
      } = {
        name: fc.name,
        response: {
          output: toolOutput as Record<string, unknown>,
        },
      };

      // Match each result to its original call ID
      if (fc.id) {
        functionResponseObj.id = fc.id;
      }

      toolResponseParts.push({
        functionResponse: functionResponseObj,
      });
    }

    // 2. Append function results turn using role "user" (Gemini generateContent REST protocol)
    // NEVER use role "function" as a Content role
    contents.push({
      role: "user",
      parts: toolResponseParts,
    });
  }

  // If iteration limit was hit without final text, generate a closing response
  if (!finalAssistantText) {
    finalAssistantText = `I completed ${executedRecords.length} tool evaluations to analyze your request. Please review the detailed telemetry provided above.`;
  }

  const modelUsed = options.geminiOptions?.model || process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const hasStructured = Object.keys(structuredData).length > 0;

  return {
    isLiveGemini: true,
    engine: `Google Gemini (${modelUsed})`,
    toolsExecuted: Array.from(toolsExecutedNames),
    structuredData: hasStructured ? structuredData : undefined,
    message: {
      id: `msg_${Date.now()}`,
      sender: "assistant",
      text: finalAssistantText,
      timestamp,
      toolCalls: executedRecords,
      suggestions: [
        "Analyse today's revenue",
        "Detect payment anomalies",
        "Show 7-day cash flow forecast",
      ],
      isDemoSample: false,
      modelEngine: modelUsed,
      structuredData: hasStructured ? structuredData : undefined,
    },
  };
}
