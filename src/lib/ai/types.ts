import type { RevenueAnalyticsResult } from "./tools/revenue-analytics.ts";
import type { CashFlowForecastResult } from "./tools/cashflow-forecaster.ts";
import type { AnomalyDetectionResult } from "./tools/anomaly-detector.ts";
import type { OverdueDetectionResult } from "./tools/overdue-detector.ts";
import type { BusinessRecommendationsResult } from "./tools/business-recommendations.ts";

export interface AIStructuredData {
  revenue?: RevenueAnalyticsResult;
  forecast?: CashFlowForecastResult;
  anomalies?: AnomalyDetectionResult;
  overdue?: OverdueDetectionResult;
  recommendations?: BusinessRecommendationsResult;
}

export interface AIChatMessage {
  id: string;
  sender: "user" | "assistant" | "system";
  text: string;
  timestamp: string;
  toolCalls?: ToolExecutionRecord[];
  suggestions?: string[];
  isDemoSample?: boolean;
  modelEngine?: string;
  structuredData?: AIStructuredData;
}

export interface ToolExecutionRecord {
  toolName: string;
  arguments: Record<string, unknown>;
  resultSummary?: string;
  executedAt?: string;
  safeData?: Record<string, unknown>;
}

export interface AIToolDefinition {
  name: string;
  description: string;
  parameters: Record<
    string,
    {
      type: string;
      description: string;
      required?: boolean;
      enum?: string[];
    }
  >;
}

export interface AIServiceResponse {
  message: AIChatMessage;
  toolsExecuted: string[];
  isLiveGemini?: boolean;
  engine?: string;
  structuredData?: AIStructuredData;
}

export interface AIChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface AIChatRequestBody {
  message: string;
  history?: AIChatHistoryItem[];
  asOfDate?: string;
}

export interface AIChatResponseBody {
  success: boolean;
  message: AIChatMessage;
  toolsExecuted: string[];
  isLiveGemini: boolean;
  engine: string;
  error?: string;
  structuredData?: AIStructuredData;
}
