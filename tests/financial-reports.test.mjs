/**
 * PayPilot: Financial Reports & Ledger Reconciliation Audit Test Suite
 *
 * Enforces:
 * 1. Scope A: 7-Day Consolidated Revenue Telemetry (Macro Audit)
 *    - DEMO_DAILY_REVENUE sums to $12,480.00 gross across 184 orders.
 *    - Prior week baseline sums to $10,820.00 (+15.3% growth).
 *    - Daily revenue CSV export contains 7 daily records totaling $12,480.00.
 *
 * 2. Scope B: Itemized Transactions Ledger (Micro Audit)
 *    - DEMO_TRANSACTIONS contains 12 verified records totaling $8,604.00 gross.
 *    - Completed: 7 records, $7,294.00 gross, $194.12 fees, $7,099.88 net settled.
 *    - Pending: 2 records, $840.00 gross, $24.96 fees, $815.04 net.
 *    - Failed: 3 records, $470.00 gross, $0 fee, $0 net.
 *    - Mathematical invariant: netAmount === amount - fee across all non-failed records.
 *    - Transaction CSV export contains 12 records matching these exact totals.
 *
 * 3. Scope C: Itemized Orders Pipeline (Micro Audit)
 *    - DEMO_ORDERS contains 7 customer orders totaling $5,574.00 total amount.
 *    - Pending: 2 orders (ORD-7799 and ORD-7795) totaling exactly $840.00.
 *    - Fulfilled: 3 orders ($3,699.00), Processing: 1 order ($890.00), Cancelled: 1 order ($145.00).
 *    - Orders CSV export contains 7 records matching these exact totals.
 *
 * 4. Cross-Dataset Reconciliation & Consistency Contract
 *    - Orders pipeline pending volume ($840.00) matches transaction ledger pending volume ($840.00) 1:1.
 *    - Pending order IDs (ORD-7799, ORD-7795) match pending transaction order IDs (TXN-89410, TXN-89406).
 *    - DEMO_KPI_METRICS reconciles: totalRevenue = 12480, successfulPayments = 184, pendingOrders = 2, pendingAmount = 840.
 *
 * 5. ReportsView Component Audit
 *    - Distinguishes Macro Telemetry ($12,480.00) from Micro Transaction Ledger ($8,604.00).
 *    - Table footer sums to $12,480.00 and 184 orders.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import {
  DEMO_KPI_METRICS,
  DEMO_DAILY_REVENUE,
  DEMO_TRANSACTIONS,
  DEMO_ORDERS,
} from "../src/lib/demo-data.ts";

describe("PayPilot Financial Reports & Ledger Reconciliation Audit", () => {
  // ─── 1. Scope A: 7-Day Consolidated Daily Revenue (Macro) ───────────────────

  test("1. Macro Telemetry: Daily revenue totals exactly $12,480.00 gross volume", () => {
    assert.equal(DEMO_DAILY_REVENUE.length, 7, "Must contain 7 daily revenue records");

    const totalGross = DEMO_DAILY_REVENUE.reduce((sum, d) => sum + d.revenue, 0);
    assert.equal(
      totalGross,
      12480.0,
      "Sum of daily gross revenue across 7 days must equal exactly $12,480.00"
    );

    assert.equal(
      DEMO_KPI_METRICS.totalRevenue,
      12480.0,
      "KPI totalRevenue must match 7-day consolidated revenue of $12,480.00"
    );
  });

  test("2. Macro Telemetry: Daily orders total exactly 184 cleared payments", () => {
    const totalOrders = DEMO_DAILY_REVENUE.reduce((sum, d) => sum + d.orders, 0);
    assert.equal(
      totalOrders,
      184,
      "Sum of daily orders across 7 days must equal exactly 184"
    );

    assert.equal(
      DEMO_KPI_METRICS.successfulPayments,
      184,
      "KPI successfulPayments must equal 184 cleared orders"
    );
  });

  test("3. Macro Telemetry: Prior week baseline totals exactly $10,820.00 with positive growth", () => {
    const totalBaseline = DEMO_DAILY_REVENUE.reduce(
      (sum, d) => sum + d.previousWeekRevenue,
      0
    );
    assert.equal(
      totalBaseline,
      10820.0,
      "Sum of daily prior week baseline across 7 days must equal exactly $10,820.00"
    );

    const growth = Number((((12480 - 10820) / 10820) * 100).toFixed(1));
    assert.equal(growth, 15.3, "7-day consolidated net growth must equal +15.3%");
  });

  // ─── 2. Scope B: Itemized Transactions Ledger (Micro) ───────────────────────

  test("4. Itemized Ledger: 12 transaction records sum to exactly $8,604.00 gross", () => {
    assert.equal(DEMO_TRANSACTIONS.length, 12, "Must contain exactly 12 transaction records");

    const totalGross = Number(
      DEMO_TRANSACTIONS.reduce((sum, t) => sum + t.amount, 0).toFixed(2)
    );
    assert.equal(
      totalGross,
      8604.0,
      "Sum of all 12 transaction amounts must equal exactly $8,604.00"
    );
  });

  test("5. Itemized Ledger: 7 completed transactions total $7,294.00 gross, $194.12 fees, $7,099.88 net", () => {
    const completed = DEMO_TRANSACTIONS.filter((t) => t.status === "completed");
    assert.equal(completed.length, 7, "Must contain exactly 7 completed transactions");

    const gross = Number(completed.reduce((s, t) => s + t.amount, 0).toFixed(2));
    const fees = Number(completed.reduce((s, t) => s + t.fee, 0).toFixed(2));
    const net = Number(completed.reduce((s, t) => s + t.netAmount, 0).toFixed(2));

    assert.equal(gross, 7294.0, "Completed gross volume must equal $7,294.00");
    assert.equal(fees, 194.12, "Completed transaction fees must equal $194.12");
    assert.equal(net, 7099.88, "Completed net settled funds must equal $7,099.88");
    assert.equal(
      Number((gross - fees).toFixed(2)),
      net,
      "Mathematical invariant: gross - fees must equal net settled funds"
    );
  });

  test("6. Itemized Ledger: 2 pending transactions total $840.00 gross, $24.96 fees, $815.04 net", () => {
    const pending = DEMO_TRANSACTIONS.filter((t) => t.status === "pending");
    assert.equal(pending.length, 2, "Must contain exactly 2 pending transactions");

    const gross = Number(pending.reduce((s, t) => s + t.amount, 0).toFixed(2));
    const fees = Number(pending.reduce((s, t) => s + t.fee, 0).toFixed(2));
    const net = Number(pending.reduce((s, t) => s + t.netAmount, 0).toFixed(2));

    assert.equal(gross, 840.0, "Pending gross volume must equal $840.00");
    assert.equal(fees, 24.96, "Pending transaction fees must equal $24.96");
    assert.equal(net, 815.04, "Pending net funds must equal $815.04");
    assert.equal(
      Number((gross - fees).toFixed(2)),
      net,
      "Mathematical invariant: gross - fees must equal net"
    );
  });

  test("7. Itemized Ledger: 3 failed transactions total $470.00 gross with zero fees/net", () => {
    const failed = DEMO_TRANSACTIONS.filter((t) => t.status === "failed");
    assert.equal(failed.length, 3, "Must contain exactly 3 failed transactions");

    const gross = Number(failed.reduce((s, t) => s + t.amount, 0).toFixed(2));
    const fees = Number(failed.reduce((s, t) => s + t.fee, 0).toFixed(2));
    const net = Number(failed.reduce((s, t) => s + t.netAmount, 0).toFixed(2));

    assert.equal(gross, 470.0, "Failed transaction volume must equal $470.00");
    assert.equal(fees, 0.0, "Failed transactions must incur 0 fee");
    assert.equal(net, 0.0, "Failed transactions must have 0 net amount");
  });

  // ─── 3. Scope C: Itemized Customer Orders Pipeline (Micro) ──────────────────

  test("8. Orders Pipeline: 7 customer orders sum to exactly $5,574.00 total volume", () => {
    assert.equal(DEMO_ORDERS.length, 7, "Must contain exactly 7 customer orders");

    const totalAmount = Number(
      DEMO_ORDERS.reduce((s, o) => s + o.totalAmount, 0).toFixed(2)
    );
    assert.equal(totalAmount, 5574.0, "Total order amount must equal $5,574.00");
  });

  test("9. Orders Pipeline: Exactly 2 orders are pending fulfillment totaling $840.00", () => {
    const pendingOrders = DEMO_ORDERS.filter((o) => o.status === "pending");
    assert.equal(pendingOrders.length, 2, "Must contain exactly 2 pending orders");

    const pendingSum = Number(
      pendingOrders.reduce((s, o) => s + o.totalAmount, 0).toFixed(2)
    );
    assert.equal(pendingSum, 840.0, "Pending orders total must equal $840.00");

    const expectedOrderNumbers = ["ORD-7799", "ORD-7795"];
    const actualOrderNumbers = pendingOrders.map((o) => o.orderNumber).sort();
    assert.deepEqual(actualOrderNumbers, expectedOrderNumbers.sort());
  });

  // ─── 4. Cross-Dataset Reconciliation ────────────────────────────────────────

  test("10. Reconciliation: Orders pipeline pending ($840.00) matches transaction ledger pending ($840.00) 1:1", () => {
    const pendingOrders = DEMO_ORDERS.filter((o) => o.status === "pending");
    const pendingTxns = DEMO_TRANSACTIONS.filter((t) => t.status === "pending");

    const orderPendingVolume = pendingOrders.reduce((s, o) => s + o.totalAmount, 0);
    const txnPendingVolume = pendingTxns.reduce((s, t) => s + t.amount, 0);

    assert.equal(
      orderPendingVolume,
      txnPendingVolume,
      "Pending volume in orders pipeline must match pending volume in transactions ledger to the cent"
    );
    assert.equal(orderPendingVolume, 840.0);

    // Verify 1:1 transaction mapping
    for (const pendingOrder of pendingOrders) {
      const matchingTxn = pendingTxns.find((t) => t.orderId === pendingOrder.orderNumber);
      assert.ok(
        matchingTxn,
        `Pending order ${pendingOrder.orderNumber} must have matching pending transaction`
      );
      assert.equal(
        matchingTxn.amount,
        pendingOrder.totalAmount,
        `Transaction amount for ${matchingTxn.id} must match order total for ${pendingOrder.orderNumber}`
      );
    }
  });

  test("11. Reconciliation: DEMO_KPI_METRICS reconciles with underlying records", () => {
    // 7-day macro revenue
    assert.equal(DEMO_KPI_METRICS.totalRevenue, 12480.0);
    assert.equal(DEMO_KPI_METRICS.successfulPayments, 184);

    // Pending orders & amounts
    assert.equal(
      DEMO_KPI_METRICS.pendingOrders,
      2,
      "pendingOrders must equal 2 (matches DEMO_ORDERS pending count)"
    );
    assert.equal(
      DEMO_KPI_METRICS.pendingAmount,
      840.0,
      "pendingAmount must equal $840.00 (matches DEMO_ORDERS & DEMO_TRANSACTIONS pending sum)"
    );

    // Failed payments
    assert.equal(
      DEMO_KPI_METRICS.failedPayments,
      3,
      "failedPayments must equal 3 (matches 3 failed transactions)"
    );
  });

  // ─── 5. CSV Export Format & Data Integrity ──────────────────────────────────

  test("12. CSV Export: paypilot_transactions_report.csv structure and row count", () => {
    const headers =
      "Transaction_ID,Customer_Name,Customer_Email,Amount_USD,Fee_USD,Net_USD,Channel,Status,Timestamp,Description";
    const rows = DEMO_TRANSACTIONS.map(
      (t) =>
        `"${t.id}","${t.customerName}","${t.customerEmail}",${t.amount},${t.fee},${t.netAmount},"${t.paymentMethod}","${t.status}","${t.timestamp}","${t.description.replace(/"/g, '""')}"`
    );

    assert.equal(rows.length, 12, "Must generate exactly 12 CSV data rows");

    // Verify header columns
    const cols = headers.split(",");
    assert.equal(cols.length, 10);
    assert.ok(cols.includes("Amount_USD"));
    assert.ok(cols.includes("Fee_USD"));
    assert.ok(cols.includes("Net_USD"));

    // Verify row calculation sums
    const parsedAmounts = rows.map((r) => {
      const parts = r.split(",");
      return {
        amount: parseFloat(parts[3]),
        fee: parseFloat(parts[4]),
        net: parseFloat(parts[5]),
      };
    });

    const sumAmount = Number(parsedAmounts.reduce((s, p) => s + p.amount, 0).toFixed(2));
    const sumFee = Number(parsedAmounts.reduce((s, p) => s + p.fee, 0).toFixed(2));
    const sumNet = Number(parsedAmounts.reduce((s, p) => s + p.net, 0).toFixed(2));

    assert.equal(sumAmount, 8604.0, "Exported CSV Amount_USD must sum to $8,604.00");
    assert.equal(sumFee, 219.08, "Exported CSV Fee_USD must sum to $219.08");
    assert.equal(sumNet, 7914.92, "Exported CSV Net_USD must sum to $7,914.92");
  });

  test("13. CSV Export: paypilot_orders_report.csv structure and row count", () => {
    const headers =
      "Order_Number,Customer_Name,Customer_Email,Total_Amount_USD,Status,Items_Count,Created_At,Tracking_Number";
    const rows = DEMO_ORDERS.map(
      (o) =>
        `"${o.orderNumber}","${o.customerName}","${o.customerEmail}",${o.totalAmount},"${o.status}",${o.items.length},"${o.createdAt}","${o.trackingNumber || "N/A"}"`
    );

    assert.equal(rows.length, 7, "Must generate exactly 7 CSV data rows");

    const sumTotal = Number(
      rows.reduce((s, r) => s + parseFloat(r.split(",")[3]), 0).toFixed(2)
    );
    assert.equal(sumTotal, 5574.0, "Exported CSV Total_Amount_USD must sum to $5,574.00");
  });

  test("14. CSV Export: paypilot_daily_revenue_report.csv structure and row count", () => {
    const headers = "Date,Formatted_Date,Revenue_USD,Orders_Count,Prior_Week_Baseline_USD";
    const rows = DEMO_DAILY_REVENUE.map(
      (d) =>
        `"${d.date}","${d.formattedDate}",${d.revenue},${d.orders},${d.previousWeekRevenue}`
    );

    assert.equal(rows.length, 7, "Must generate exactly 7 CSV daily records");

    const sumRevenue = Number(
      rows.reduce((s, r) => s + parseFloat(r.split(",")[2]), 0).toFixed(2)
    );
    assert.equal(sumRevenue, 12480.0, "Exported CSV Revenue_USD must sum to $12,480.00");

    const sumOrders = rows.reduce((s, r) => s + parseInt(r.split(",")[3], 10), 0);
    assert.equal(sumOrders, 184, "Exported CSV Orders_Count must sum to 184");
  });

  // ─── 6. ReportsView UI Static Analysis ──────────────────────────────────────

  test("15. ReportsView: Explicitly displays scope labels and contract explanation", async () => {
    const src = await fs.readFile("src/components/reports/ReportsView.tsx", "utf8");

    // Scope labels
    assert.ok(
      src.includes("Macro Telemetry (7-Day)") || src.includes("Macro Telemetry"),
      "ReportsView must display Macro Telemetry scope label"
    );
    assert.ok(
      src.includes("Itemized Ledger") || src.includes("Itemized Transactions"),
      "ReportsView must display Itemized Ledger scope label"
    );
    assert.ok(
      src.includes("Orders Pipeline"),
      "ReportsView must display Orders Pipeline scope label"
    );

    // Explanatory scope disclosure
    assert.ok(
      src.includes("Scope Distinction") || src.includes("Reporting Contract"),
      "ReportsView must contain a scope distinction / reporting contract disclosure"
    );

    // Multi-scope reconciliation matrix
    assert.ok(
      src.includes("Reconciliation Matrix") || src.includes("Financial Reconciliation"),
      "ReportsView must include a financial reconciliation matrix"
    );

    // Table audit footer
    assert.ok(
      src.includes("<tfoot>") && src.includes("7-Day Total"),
      "ReportsView consolidated ledger table must include a <tfoot> summing the 7-day totals"
    );
  });
});
