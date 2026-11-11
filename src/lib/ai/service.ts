import { AIChatMessage, AIToolDefinition, AIServiceResponse } from "./types";
import {
  DEMO_KPI_METRICS,
  DEMO_TRANSACTIONS,
  DEMO_ORDERS,
  DEMO_INSIGHTS,
  DEMO_APPROVALS,
  DEMO_DAILY_REVENUE,
} from "@/lib/demo-data";

export const AI_AVAILABLE_TOOLS: AIToolDefinition[] = [
  {
    name: "get_business_summary",
    description: "Fetches verified business KPIs, total revenue, success rate, and pending pipeline metrics.",
    parameters: {},
  },
  {
    name: "list_transactions",
    description: "Queries recent transactions with optional status filtering.",
    parameters: {
      status: { type: "string", description: "Filter by status: completed | pending | failed" },
      limit: { type: "number", description: "Number of records to return" },
    },
  },
  {
    name: "get_order_details",
    description: "Retrieves specific order line items, fulfillment status, and customer contact.",
    parameters: {
      orderNumber: { type: "string", description: "The order identifier e.g. ORD-7801", required: true },
    },
  },
  {
    name: "detect_anomalies",
    description: "Evaluates recent transaction patterns for failure clusters or velocity anomalies.",
    parameters: {},
  },
  {
    name: "generate_report",
    description: "Compiles complete business performance statistics and export-ready summaries.",
    parameters: {
      period: { type: "string", description: "Reporting interval e.g. last_7_days" },
    },
  },
];

// Verified backend ground-truth tool implementations
export const aiToolHandlers = {
  get_business_summary: () => {
    return {
      revenue: DEMO_KPI_METRICS.totalRevenue,
      successfulPayments: DEMO_KPI_METRICS.successfulPayments,
      pendingOrders: DEMO_KPI_METRICS.pendingOrders,
      failedPayments: DEMO_KPI_METRICS.failedPayments,
      successRate: `${DEMO_KPI_METRICS.successRate}%`,
      growth: `+${DEMO_KPI_METRICS.revenueGrowth}%`,
    };
  },
  list_transactions: (status?: string) => {
    if (!status || status === "all") return DEMO_TRANSACTIONS.slice(0, 5);
    return DEMO_TRANSACTIONS.filter((t) => t.status === status).slice(0, 5);
  },
  get_order_details: (orderNumber: string) => {
    return DEMO_ORDERS.find((o) => o.orderNumber === orderNumber) || null;
  },
  detect_anomalies: () => {
    const failed = DEMO_TRANSACTIONS.filter((t) => t.status === "failed");
    return {
      anomalyCount: failed.length,
      failedTransactions: failed.map((f) => ({
        id: f.id,
        amount: f.amount,
        customer: f.customerName,
        reason: f.description,
      })),
      riskScore: "Low (1.6% decline rate)",
    };
  },
  generate_report: () => {
    return {
      totalVolume: DEMO_KPI_METRICS.totalRevenue,
      transactionCount: DEMO_TRANSACTIONS.length,
      topChannel: "PayPal Checkout (58% of volume)",
      avgTicketSize: `$${(DEMO_KPI_METRICS.totalRevenue / DEMO_KPI_METRICS.successfulPayments).toFixed(2)}`,
    };
  },
};

export async function processAIChatPrompt(prompt: string): Promise<AIServiceResponse> {
  const normalized = prompt.toLowerCase();
  const timestamp = new Date().toISOString();

  // Simulated latency for authentic feel
  await new Promise((resolve) => setTimeout(resolve, 600));

  if (normalized.includes("today's business") || normalized.includes("activity") || normalized.includes("summary")) {
    const summary = aiToolHandlers.get_business_summary();
    return {
      toolsExecuted: ["get_business_summary"],
      message: {
        id: `msg_${Date.now()}`,
        sender: "assistant",
        text: `### Verified Business Summary\n\nBased on your verified store ledger:\n- **Total Revenue:** $${summary.revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n- **Successful Payments:** ${summary.successfulPayments} (${summary.successRate} success rate)\n- **Pending Pipeline:** ${summary.pendingOrders} orders ($1,840.50 volume)\n- **Growth Rate:** ${summary.growth} vs prior weekly period\n\nOperations are running smoothly with PayPal Checkout delivering optimal payment conversion.`,
        timestamp,
        suggestions: ["Find transactions that need attention", "Generate a business performance report"],
        isDemoSample: true,
      },
    };
  }

  if (normalized.includes("attention") || normalized.includes("failed") || normalized.includes("unusual") || normalized.includes("anomal")) {
    const anomalies = aiToolHandlers.detect_anomalies();
    return {
      toolsExecuted: ["detect_anomalies"],
      message: {
        id: `msg_${Date.now()}`,
        sender: "assistant",
        text: `### Anomaly & Attention Audit\n\nI scanned current transactions and identified **${anomalies.anomalyCount} declined transactions** requiring merchant review:\n\n1. **Chen Wei (TXN-89408):** $145.00 - Insufficient available card funds.\n2. **Rafael Santos (TXN-89404):** $95.00 - Card expired at authorization.\n3. **Zara Fatima (TXN-89401):** $230.00 - SWIFT wire routing mismatch.\n\n**Recommendation:** Trigger automated customer retry emails or offer alternative PayPal checkout methods.`,
        timestamp,
        suggestions: ["Review pending approvals", "Summarise this week's revenue"],
        isDemoSample: true,
      },
    };
  }

  if (normalized.includes("revenue") || normalized.includes("week")) {
    const totalRev = DEMO_KPI_METRICS.totalRevenue;
    return {
      toolsExecuted: ["get_business_summary"],
      message: {
        id: `msg_${Date.now()}`,
        sender: "assistant",
        text: `### 7-Day Revenue Summary\n\n- **Gross Volume:** $${totalRev.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n- **Top Day:** Nov 03 ($2,190.25 across 31 orders)\n- **Trailing Growth:** +14.2% week-over-week\n- **Dispute Ratio:** 0.08% (well within PayPal compliance thresholds < 1.0%)\n\nAll cash settlements are scheduled on a T+1 automated payout schedule.`,
        timestamp,
        suggestions: ["Generate a business performance report", "Find transactions that need attention"],
        isDemoSample: true,
      },
    };
  }

  if (normalized.includes("report") || normalized.includes("performance")) {
    const rep = aiToolHandlers.generate_report();
    return {
      toolsExecuted: ["generate_report", "get_business_summary"],
      message: {
        id: `msg_${Date.now()}`,
        sender: "assistant",
        text: `### Executive Performance Report\n\n- **Total Revenue:** $${rep.totalVolume.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n- **Average Ticket Size:** ${rep.avgTicketSize}\n- **Primary Gateway:** ${rep.topChannel}\n- **Active Approvals:** ${DEMO_APPROVALS.filter((a) => a.status === "pending").length} items pending authorization\n\nYou can export the full transaction and order ledger as CSV from the **Reports** tab.`,
        timestamp,
        suggestions: ["Analyse today's business activity", "Summarise this week's revenue"],
        isDemoSample: true,
      },
    };
  }

  // Default response for custom queries
  return {
    toolsExecuted: ["get_business_summary"],
    message: {
      id: `msg_${Date.now()}`,
      sender: "assistant",
      text: `### PayPilot Assistant (Phase 1 Demo)\n\nI processed your request: **"${prompt}"**.\n\nIn Phase 1, PayPilot operates with verified local demo data and provider-independent tool handlers. In Phase 2, this will be connected directly to an enterprise LLM (e.g., Gemini / OpenAI) while maintaining strict ground truth verification through the backend tools.`,
      timestamp,
      suggestions: [
        "Analyse today's business activity",
        "Find transactions that need attention",
        "Summarise this week's revenue",
        "Generate a business performance report",
      ],
      isDemoSample: true,
    },
  };
}
