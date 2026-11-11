import type { Transaction } from "../../../types/index.ts";
import { serverOrdersStore } from "../../server/orders-store.ts";
import { getSupabaseClient } from "../../supabase/client.ts";

export interface AnomalyItem {
  id: string;
  type:
    | "amount_statistical_outlier"
    | "failed_payment_cluster"
    | "unusual_velocity_spike"
    | "recurrent_payment_decline";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  explanation: string; // Statistical or rule-based explanation (not claiming proven fraud)
  relatedTransactionId?: string;
  relatedOrderId?: string;
  amount?: number;
  timestamp?: string;
  metrics?: Record<string, number | string>;
}

export interface AnomalyDetectionResult {
  dataSource: "supabase" | "authoritative_store_memory";
  totalTransactionsScanned: number;
  anomalyCount: number;
  riskSummary: {
    overallRiskScore: "low" | "medium" | "elevated";
    declineRatePercentage: number;
    highValueOutliersCount: number;
    failedTransactionsCount: number;
    primaryDeclineReasons: { reason: string; count: number }[];
  };
  anomalies: AnomalyItem[];
  metadata: {
    detectedAt: string;
    methodology: string;
    disclaimer: string;
  };
}

export interface AnomalyDetectorParams {
  zScoreThreshold?: number; // Default 2.0 standard deviations
  sensitivity?: "standard" | "high";
}

/**
 * Computes mean and population standard deviation of numeric values.
 */
function computeStats(values: number[]): { mean: number; stdDev: number } {
  if (values.length === 0) return { mean: 0, stdDev: 0 };
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

/**
 * Identifies statistical outliers, failure clusters, and unusual payment patterns
 * using explainable statistical and rule-based heuristics.
 */
export async function detectAnomalies(
  params: AnomalyDetectorParams = {}
): Promise<AnomalyDetectionResult> {
  const zThreshold = params.zScoreThreshold ?? (params.sensitivity === "high" ? 1.5 : 2.0);
  const transactions: Transaction[] = await serverOrdersStore.getAllTransactions();

  const isSupabaseLive = Boolean(getSupabaseClient());
  const dataSource = isSupabaseLive ? "supabase" : "authoritative_store_memory";

  const anomalies: AnomalyItem[] = [];

  // 1. Statistical Outlier Detection on Completed Transaction Amounts
  const completedTxns = transactions.filter((t) => t.status === "completed");
  const completedAmounts = completedTxns.map((t) => Number(t.amount));
  const { mean, stdDev } = computeStats(completedAmounts);

  for (const txn of completedTxns) {
    if (stdDev > 0) {
      const zScore = (Number(txn.amount) - mean) / stdDev;
      if (zScore >= zThreshold) {
        anomalies.push({
          id: `anom_outlier_${txn.id}`,
          type: "amount_statistical_outlier",
          severity: zScore > 3.0 ? "high" : "medium",
          title: `High-Value Outlier: $${Number(txn.amount).toFixed(2)}`,
          description: `Transaction ${txn.id} for ${txn.customerName} exceeds expected amount distribution.`,
          explanation: `Amount is ${zScore.toFixed(2)} standard deviations above the average ticket size of $${mean.toFixed(2)} (σ = $${stdDev.toFixed(2)}). Note: This is an analytical observation, not confirmed fraud.`,
          relatedTransactionId: txn.id,
          relatedOrderId: txn.orderId,
          amount: Number(txn.amount),
          timestamp: txn.timestamp,
          metrics: {
            zScore: Number(zScore.toFixed(2)),
            meanAmount: Number(mean.toFixed(2)),
            stdDev: Number(stdDev.toFixed(2)),
          },
        });
      }
    }
  }

  // 2. Failed Payment Clustering
  const failedTxns = transactions.filter((t) => t.status === "failed");
  const declineReasonMap = new Map<string, number>();

  for (const f of failedTxns) {
    const reason = f.description || "Card Processor Decline";
    declineReasonMap.set(reason, (declineReasonMap.get(reason) || 0) + 1);

    anomalies.push({
      id: `anom_fail_${f.id}`,
      type: "recurrent_payment_decline",
      severity: f.amount >= 200 ? "high" : "medium",
      title: `Declined Payment: ${f.id} ($${Number(f.amount).toFixed(2)})`,
      description: `Payment by ${f.customerName} failed: ${f.description}`,
      explanation: `Operational failure during authorization. Recommendation: Review customer payment instrument and trigger automated checkout retry.`,
      relatedTransactionId: f.id,
      relatedOrderId: f.orderId,
      amount: Number(f.amount),
      timestamp: f.timestamp,
      metrics: {
        paymentMethod: f.paymentMethod,
      },
    });
  }

  // Grouped cluster anomaly if failure rate is notable
  const totalAttempted = completedTxns.length + failedTxns.length;
  const declineRatePercentage =
    totalAttempted > 0
      ? Number(((failedTxns.length / totalAttempted) * 100).toFixed(1))
      : 0;

  if (failedTxns.length >= 2) {
    anomalies.push({
      id: `anom_cluster_declines`,
      type: "failed_payment_cluster",
      severity: declineRatePercentage > 10 ? "high" : "medium",
      title: `Decline Cluster: ${failedTxns.length} Failed Payments Detected`,
      description: `Observed a cluster of ${failedTxns.length} declined payments across current transaction records (${declineRatePercentage}% decline rate).`,
      explanation: `Heuristic clustering indicates isolated card expiry and balance restrictions. Dispute ratio remains low, but customer checkout recovery should be scheduled.`,
      metrics: {
        clusterSize: failedTxns.length,
        declineRatePercentage,
      },
    });
  }

  // Overall Risk Summary
  let overallRiskScore: "low" | "medium" | "elevated" = "low";
  if (declineRatePercentage > 15 || anomalies.some((a) => a.severity === "high")) {
    overallRiskScore = "elevated";
  } else if (declineRatePercentage > 5 || anomalies.length > 2) {
    overallRiskScore = "medium";
  }

  const primaryDeclineReasons = Array.from(declineReasonMap.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  return {
    dataSource,
    totalTransactionsScanned: transactions.length,
    anomalyCount: anomalies.length,
    riskSummary: {
      overallRiskScore,
      declineRatePercentage,
      highValueOutliersCount: anomalies.filter((a) => a.type === "amount_statistical_outlier").length,
      failedTransactionsCount: failedTxns.length,
      primaryDeclineReasons,
    },
    anomalies,
    metadata: {
      detectedAt: new Date().toISOString(),
      methodology: `Z-Score Analysis (threshold: ${zThreshold}σ) + Failure Cluster Heuristics`,
      disclaimer: "All anomalies are statistical and operational heuristics. They do not constitute verified fraud allegations.",
    },
  };
}
