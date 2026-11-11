import type { Order, OrderStatus } from "../../../types/index.ts";
import { serverOrdersStore } from "../../server/orders-store.ts";
import { getSupabaseClient } from "../../supabase/client.ts";

export interface OverdueOrderIssue {
  orderId: string;
  orderNumber: string;
  customerNameMasked: string;
  customerEmailMasked: string;
  amount: number;
  currency: string;
  createdAt: string;
  ageHours: number;
  status: OrderStatus;
  severity: "critical" | "warning" | "info";
  reason: string;
  suggestedAction: string;
  hasPayPalOrderLinked: boolean;
  paypalOrderId?: string;
}

export interface OverdueDetectionResult {
  dataSource: "supabase" | "authoritative_store_memory";
  thresholdHours: number;
  totalOrdersScanned: number;
  totalPendingOrders: number;
  overdueOrdersCount: number;
  totalAtRiskAmount: number;
  currency: string;
  overdueOrders: OverdueOrderIssue[];
  metadata: {
    scannedAt: string;
    referenceDate: string;
  };
}

export interface OverdueDetectorParams {
  thresholdHours?: number;
  asOfDate?: string; // Optional ISO string or YYYY-MM-DD anchor for deterministic evaluation
}

/**
 * Masks customer name to safeguard customer privacy in AI context (e.g. "Sophia Dubois" -> "Sophia D.")
 */
function maskCustomerName(name: string): string {
  if (!name || name.trim().length === 0) return "Anonymous";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

/**
 * Masks customer email to safeguard customer privacy (e.g. "s.dubois@luxatelier.fr" -> "s***@luxatelier.fr")
 */
function maskCustomerEmail(email: string): string {
  if (!email || !email.includes("@")) return "masked@customer.local";
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local.charAt(0)}***@${domain}`;
  return `${local.charAt(0)}***${local.charAt(local.length - 1)}@${domain}`;
}

/**
 * Scans orders to identify pending orders that have exceeded the age threshold,
 * awaiting payment authorization, or requiring customer follow-up.
 */
export async function detectOverdueOrders(
  params: OverdueDetectorParams = {}
): Promise<OverdueDetectionResult> {
  const thresholdHours = Math.max(1, params.thresholdHours ?? 24);
  const orders: Order[] = await serverOrdersStore.getAllOrders();

  const isSupabaseLive = Boolean(getSupabaseClient());
  const dataSource = isSupabaseLive ? "supabase" : "authoritative_store_memory";

  // Determine reference time
  let referenceTime: number;
  if (params.asOfDate) {
    referenceTime = new Date(params.asOfDate).getTime();
  } else if (orders.length > 0) {
    const latestOrderTime = Math.max(
      ...orders.map((o) => new Date(o.createdAt).getTime())
    );
    referenceTime = Math.max(Date.now(), latestOrderTime);
  } else {
    referenceTime = Date.now();
  }

  const msPerHour = 3_600_000;
  const overdueOrders: OverdueOrderIssue[] = [];

  const pendingOrders = orders.filter((o) => o.status === "pending");

  for (const order of pendingOrders) {
    const orderTime = new Date(order.createdAt).getTime();
    const ageHours = Number(((referenceTime - orderTime) / msPerHour).toFixed(1));

    if (ageHours >= thresholdHours) {
      // Determine severity based on age and transaction value
      let severity: "critical" | "warning" | "info" = "info";
      if (ageHours > 72 || order.totalAmount >= 500) {
        severity = "critical";
      } else if (ageHours > 24 || order.totalAmount >= 200) {
        severity = "warning";
      }

      let reason = `Order has remained pending payment for ${ageHours} hours (threshold: ${thresholdHours}h).`;
      let suggestedAction = "Send automated checkout recovery notification with direct payment link.";

      if (order.paypalOrderId) {
        reason += ` PayPal order token created (${order.paypalOrderId}) but buyer has not authorized capture.`;
        suggestedAction = "Contact customer to verify if they experienced checkout friction on PayPal.";
      } else {
        reason += " No PayPal checkout session initiated yet.";
      }

      overdueOrders.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerNameMasked: maskCustomerName(order.customerName),
        customerEmailMasked: maskCustomerEmail(order.customerEmail),
        amount: Number(order.totalAmount),
        currency: order.currency || "USD",
        createdAt: order.createdAt,
        ageHours,
        status: order.status,
        severity,
        reason,
        suggestedAction,
        hasPayPalOrderLinked: Boolean(order.paypalOrderId),
        paypalOrderId: order.paypalOrderId,
      });
    }
  }

  // Sort by severity (critical first), then amount descending (higher value first),
  // then age descending as final tiebreaker — ensures deterministic output.
  const severityRank: Record<string, number> = { critical: 3, warning: 2, info: 1 };
  overdueOrders.sort((a, b) => {
    const rankDiff = severityRank[b.severity] - severityRank[a.severity];
    if (rankDiff !== 0) return rankDiff;
    // Within the same severity: highest dollar value first
    const amountDiff = b.amount - a.amount;
    if (amountDiff !== 0) return amountDiff;
    // Final tiebreaker: oldest order first
    return b.ageHours - a.ageHours;
  });

  const totalAtRiskAmount = Number(
    overdueOrders.reduce((sum, o) => sum + o.amount, 0).toFixed(2)
  );

  return {
    dataSource,
    thresholdHours,
    totalOrdersScanned: orders.length,
    totalPendingOrders: pendingOrders.length,
    overdueOrdersCount: overdueOrders.length,
    totalAtRiskAmount,
    currency: "USD",
    overdueOrders,
    metadata: {
      scannedAt: new Date().toISOString(),
      referenceDate: new Date(referenceTime).toISOString(),
    },
  };
}
