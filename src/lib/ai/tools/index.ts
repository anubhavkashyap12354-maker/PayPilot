import {
  calculateRevenueAnalytics,
  type RevenueAnalyticsParams,
  type RevenueAnalyticsResult,
} from "./revenue-analytics.ts";
import {
  detectOverdueOrders,
  type OverdueDetectorParams,
  type OverdueDetectionResult,
} from "./overdue-detector.ts";
import {
  detectAnomalies,
  type AnomalyDetectorParams,
  type AnomalyDetectionResult,
} from "./anomaly-detector.ts";
import {
  forecastCashFlow,
  type CashFlowForecasterParams,
  type CashFlowForecastResult,
} from "./cashflow-forecaster.ts";
import {
  generateBusinessRecommendations,
  type RecommendationsParams,
  type BusinessRecommendationsResult,
} from "./business-recommendations.ts";

// Re-export all sub-modules and their associated types
export * from "./revenue-analytics.ts";
export * from "./overdue-detector.ts";
export * from "./anomaly-detector.ts";
export * from "./cashflow-forecaster.ts";
export * from "./business-recommendations.ts";

export interface ToolParameterProperty {
  type: string;
  description: string;
  enum?: string[];
}

export interface ToolDefinition<TParams = any, TResult = any> {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolParameterProperty>;
    required?: string[];
  };
  execute: (params: TParams) => Promise<TResult>;
}

/**
 * Authoritative Stage 3A Tool Registry.
 * Exposes strongly typed, grounded business analytics tools formatted for
 * direct consumption by LLM agent tool-calling frameworks (e.g. Gemini 2.0 / 1.5).
 */
export const PAYPILOT_AI_TOOLS: Record<string, ToolDefinition> = {
  get_revenue_analytics: {
    name: "get_revenue_analytics",
    description:
      "Calculates authoritative store financial metrics including gross payment volume, net revenue, processing fees, successful and failed counts, average transaction value, daily revenue trends, and period-over-period growth.",
    parameters: {
      type: "object",
      properties: {
        periodDays: {
          type: "number",
          description: "Number of past days to analyze (default: 7).",
        },
        asOfDate: {
          type: "string",
          description: "Optional ISO or YYYY-MM-DD date anchor for retrospective auditing.",
        },
      },
    },
    execute: (params: RevenueAnalyticsParams) => calculateRevenueAnalytics(params),
  },

  detect_overdue_orders: {
    name: "detect_overdue_orders",
    description:
      "Scans the store ledger for pending orders that have exceeded the payment SLA age threshold, identifying uncompleted checkout sessions and orders requiring customer follow-up with privacy-masked PII.",
    parameters: {
      type: "object",
      properties: {
        thresholdHours: {
          type: "number",
          description: "Age threshold in hours before an order is classified as overdue (default: 24).",
        },
        asOfDate: {
          type: "string",
          description: "Optional ISO date anchor for historical evaluation.",
        },
      },
    },
    execute: (params: OverdueDetectorParams) => detectOverdueOrders(params),
  },

  detect_anomalies: {
    name: "detect_anomalies",
    description:
      "Evaluates transaction history using explainable statistical methods (Z-score amount outliers) and operational heuristics (failed payment clusters and recurrent decline patterns). Does not allege proven fraud.",
    parameters: {
      type: "object",
      properties: {
        zScoreThreshold: {
          type: "number",
          description: "Statistical standard deviation threshold for amount outliers (default: 2.0).",
        },
        sensitivity: {
          type: "string",
          description: "Heuristic scan sensitivity level.",
          enum: ["standard", "high"],
        },
      },
    },
    execute: (params: AnomalyDetectorParams) => detectAnomalies(params),
  },

  forecast_cash_flow: {
    name: "forecast_cash_flow",
    description:
      "Projects a 7-day forward-looking cash flow forecast by combining past daily run-rates with the active pending order pipeline. Explicitly separates realized settled funds from forecasted inflows.",
    parameters: {
      type: "object",
      properties: {
        horizonDays: {
          type: "number",
          description: "Forecast horizon in days (default: 7).",
        },
        asOfDate: {
          type: "string",
          description: "Optional ISO date anchor.",
        },
        pendingConversionRate: {
          type: "number",
          description: "Estimated percentage of pending pipeline expected to convert (default: 0.75).",
        },
      },
    },
    execute: (params: CashFlowForecasterParams) => forecastCashFlow(params),
  },

  get_business_recommendations: {
    name: "get_business_recommendations",
    description:
      "Synthesizes live revenue analytics, overdue orders, payment anomalies, and cash flow forecasts into prioritized, actionable business advice with clear operational next steps.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Filter recommendations by business domain.",
          enum: ["all", "revenue", "risk", "operations", "cash_flow"],
        },
        asOfDate: {
          type: "string",
          description: "Optional ISO date anchor.",
        },
      },
    },
    execute: (params: RecommendationsParams) => generateBusinessRecommendations(params),
  },
};

/**
 * Utility helper to convert the tool registry into Gemini API function declaration objects.
 */
export function getGeminiToolDeclarations() {
  return Object.values(PAYPILOT_AI_TOOLS).map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: "OBJECT",
      properties: Object.entries(tool.parameters.properties).reduce(
        (acc, [key, prop]) => {
          acc[key] = {
            type: prop.type.toUpperCase(),
            description: prop.description,
            ...(prop.enum ? { enum: prop.enum } : {}),
          };
          return acc;
        },
        {} as Record<string, unknown>
      ),
      required: tool.parameters.required || [],
    },
  }));
}
