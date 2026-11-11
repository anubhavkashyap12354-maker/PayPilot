import type { Order, Payment, Transaction } from "../../../types/index.ts";
import { serverOrdersStore } from "../../server/orders-store.ts";
import { getSupabaseClient } from "../../supabase/client.ts";

export interface DailyRevenueTrend {
  date: string; // YYYY-MM-DD
  formattedDate: string; // e.g. "Nov 06"
  revenue: number;
  orderCount: number;
  fee: number;
  netRevenue: number;
}

export interface RevenueAnalyticsResult {
  dataSource: "supabase" | "authoritative_store_memory";
  currency: string;
  periodDays: number;
  grossVolume: number;
  netRevenue: number;
  totalFees: number;
  successfulCount: number;
  failedCount: number;
  pendingCount: number;
  /** Total dollar value of all orders with status "pending" */
  pendingVolume: number;
  averageTransactionValue: number;
  successRate: number; // percentage, e.g. 98.4
  growthRate: number | null; // period-over-period percentage, null if prior period had 0 volume
  dailyTrends: DailyRevenueTrend[];
  metadata: {
    calculatedAt: string;
    totalTransactionsAnalyzed: number;
    referenceDate: string;
  };
}

export interface RevenueAnalyticsParams {
  periodDays?: number;
  asOfDate?: string; // Optional ISO string or YYYY-MM-DD anchor for deterministic calculation
}

/**
 * Calculates authoritative revenue analytics from server-side transactions and payments.
 * Connects to Supabase when available, falling back safely to the authoritative in-memory store.
 */
export async function calculateRevenueAnalytics(
  params: RevenueAnalyticsParams = {}
): Promise<RevenueAnalyticsResult> {
  const periodDays = Math.max(1, params.periodDays ?? 7);
  const transactions: Transaction[] = await serverOrdersStore.getAllTransactions();
  const orders: Order[] = await serverOrdersStore.getAllOrders();
  const payments: Payment[] = await serverOrdersStore.getAllPayments();

  const isSupabaseLive = Boolean(getSupabaseClient());
  const dataSource = isSupabaseLive ? "supabase" : "authoritative_store_memory";

  // Determine reference anchor date
  let anchorTime: number;
  if (params.asOfDate) {
    anchorTime = new Date(params.asOfDate).getTime();
  } else if (transactions.length > 0) {
    // If all records are in a fixed demo range, anchor to the most recent transaction timestamp
    const latestTxTime = Math.max(
      ...transactions.map((t) => new Date(t.timestamp).getTime())
    );
    // Use the max of Date.now() and latestTxTime
    anchorTime = Math.max(Date.now(), latestTxTime);
  } else {
    anchorTime = Date.now();
  }

  const msPerDay = 86_400_000;
  const currentWindowStart = anchorTime - periodDays * msPerDay;
  const priorWindowStart = anchorTime - 2 * periodDays * msPerDay;

  // Filter completed transactions in current period
  const allCompleted = transactions.filter((t) => t.status === "completed");
  const currentPeriodTxns = allCompleted.filter((t) => {
    const time = new Date(t.timestamp).getTime();
    return time >= currentWindowStart && time <= anchorTime;
  });

  // Prior period for growth comparison
  const priorPeriodTxns = allCompleted.filter((t) => {
    const time = new Date(t.timestamp).getTime();
    return time >= priorWindowStart && time < currentWindowStart;
  });

  // Core volume calculations (use all completed if current period is empty to prevent zeroing on historical data)
  const activeTxns = currentPeriodTxns.length > 0 ? currentPeriodTxns : allCompleted;

  const grossVolume = Number(
    activeTxns.reduce((sum, t) => sum + (Number(t.amount) || 0), 0).toFixed(2)
  );

  const totalFees = Number(
    activeTxns.reduce((sum, t) => {
      const fee =
        typeof t.fee === "number" && !isNaN(t.fee)
          ? t.fee
          : Number((t.amount * 0.029 + 0.3).toFixed(2));
      return sum + fee;
    }, 0).toFixed(2)
  );

  const netRevenue = Number((grossVolume - totalFees).toFixed(2));

  // Counts across all available payments/transactions
  const successfulCount = transactions.filter((t) => t.status === "completed").length;
  const failedCount = transactions.filter((t) => t.status === "failed").length;
  const pendingOrders = orders.filter((o) => o.status === "pending");
  const pendingCount = pendingOrders.length;
  // Total dollar value of all pending orders (not yet settled)
  const pendingVolume = Number(
    pendingOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0).toFixed(2)
  );

  const totalAttempted = successfulCount + failedCount;
  const successRate =
    totalAttempted > 0
      ? Number(((successfulCount / totalAttempted) * 100).toFixed(1))
      : 100;

  const averageTransactionValue =
    activeTxns.length > 0
      ? Number((grossVolume / activeTxns.length).toFixed(2))
      : 0;

  // Period-over-period growth calculation
  let growthRate: number | null = null;
  const priorVolume = priorPeriodTxns.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  if (priorVolume > 0 && currentPeriodTxns.length > 0) {
    growthRate = Number((((grossVolume - priorVolume) / priorVolume) * 100).toFixed(1));
  }

  // Daily revenue trends (grouping by YYYY-MM-DD)
  const dailyBuckets = new Map<
    string,
    { revenue: number; orderCount: number; fee: number; net: number }
  >();

  for (const t of activeTxns) {
    const dateStr = t.timestamp.split("T")[0];
    const existing = dailyBuckets.get(dateStr) || { revenue: 0, orderCount: 0, fee: 0, net: 0 };
    const tFee =
      typeof t.fee === "number" && !isNaN(t.fee)
        ? t.fee
        : Number((t.amount * 0.029 + 0.3).toFixed(2));

    existing.revenue += Number(t.amount) || 0;
    existing.orderCount += 1;
    existing.fee += tFee;
    existing.net += (Number(t.amount) || 0) - tFee;
    dailyBuckets.set(dateStr, existing);
  }

  const sortedDates = Array.from(dailyBuckets.keys()).sort();
  const dailyTrends: DailyRevenueTrend[] = sortedDates.map((dateStr) => {
    const b = dailyBuckets.get(dateStr)!;
    const d = new Date(dateStr);
    const formattedDate = d.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      timeZone: "UTC",
    });

    return {
      date: dateStr,
      formattedDate,
      revenue: Number(b.revenue.toFixed(2)),
      orderCount: b.orderCount,
      fee: Number(b.fee.toFixed(2)),
      netRevenue: Number(b.net.toFixed(2)),
    };
  });

  return {
    dataSource,
    currency: "USD",
    periodDays,
    grossVolume,
    netRevenue,
    totalFees,
    successfulCount,
    failedCount,
    pendingCount,
    pendingVolume,
    averageTransactionValue,
    successRate,
    growthRate,
    dailyTrends,
    metadata: {
      calculatedAt: new Date().toISOString(),
      totalTransactionsAnalyzed: transactions.length,
      referenceDate: new Date(anchorTime).toISOString(),
    },
  };
}
