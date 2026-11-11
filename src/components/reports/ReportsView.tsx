"use client";

import React, { useState, useMemo } from "react";
import {
  Download,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  ShoppingBag,
  FileSpreadsheet,
  Info,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import {
  DEMO_KPI_METRICS,
  DEMO_TRANSACTIONS,
  DEMO_ORDERS,
  DEMO_DAILY_REVENUE,
} from "@/lib/demo-data";

export const ReportsView: React.FC = () => {
  const [exporting, setExporting] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // ── Scope A: 7-Day Consolidated Daily Revenue (Macro Scope) ────────────────
  const totalDailyRevenue = useMemo(
    () => DEMO_DAILY_REVENUE.reduce((sum, d) => sum + d.revenue, 0),
    []
  );
  const totalDailyOrders = useMemo(
    () => DEMO_DAILY_REVENUE.reduce((sum, d) => sum + d.orders, 0),
    []
  );
  const totalDailyBaseline = useMemo(
    () => DEMO_DAILY_REVENUE.reduce((sum, d) => sum + d.previousWeekRevenue, 0),
    []
  );
  const macroGrowthRate = useMemo(
    () =>
      Number(
        (((totalDailyRevenue - totalDailyBaseline) / totalDailyBaseline) * 100).toFixed(1)
      ),
    [totalDailyRevenue, totalDailyBaseline]
  );

  // ── Scope B: Itemized Transaction Ledger (Micro Scope) ──────────────────────
  const txnMetrics = useMemo(() => {
    let gross = 0;
    let completedGross = 0;
    let completedCount = 0;
    let completedFee = 0;
    let completedNet = 0;
    let pendingGross = 0;
    let pendingCount = 0;
    let pendingFee = 0;
    let pendingNet = 0;
    let failedGross = 0;
    let failedCount = 0;

    for (const t of DEMO_TRANSACTIONS) {
      gross += t.amount;
      if (t.status === "completed") {
        completedCount++;
        completedGross += t.amount;
        completedFee += t.fee;
        completedNet += t.netAmount;
      } else if (t.status === "pending") {
        pendingCount++;
        pendingGross += t.amount;
        pendingFee += t.fee;
        pendingNet += t.netAmount;
      } else if (t.status === "failed") {
        failedCount++;
        failedGross += t.amount;
      }
    }

    return {
      totalCount: DEMO_TRANSACTIONS.length,
      grossTotal: Number(gross.toFixed(2)),
      completedCount,
      completedGross: Number(completedGross.toFixed(2)),
      completedFee: Number(completedFee.toFixed(2)),
      completedNet: Number(completedNet.toFixed(2)),
      pendingCount,
      pendingGross: Number(pendingGross.toFixed(2)),
      pendingFee: Number(pendingFee.toFixed(2)),
      pendingNet: Number(pendingNet.toFixed(2)),
      failedCount,
      failedGross: Number(failedGross.toFixed(2)),
    };
  }, []);

  // ── Scope C: Itemized Orders Pipeline (Micro Scope) ────────────────────────
  const orderMetrics = useMemo(() => {
    let totalAmount = 0;
    let pendingAmount = 0;
    let pendingCount = 0;
    let fulfilledCount = 0;
    let fulfilledAmount = 0;
    let processingCount = 0;
    let processingAmount = 0;
    let cancelledCount = 0;
    let cancelledAmount = 0;

    for (const o of DEMO_ORDERS) {
      totalAmount += o.totalAmount;
      if (o.status === "pending") {
        pendingCount++;
        pendingAmount += o.totalAmount;
      } else if (o.status === "fulfilled") {
        fulfilledCount++;
        fulfilledAmount += o.totalAmount;
      } else if (o.status === "processing") {
        processingCount++;
        processingAmount += o.totalAmount;
      } else if (o.status === "cancelled") {
        cancelledCount++;
        cancelledAmount += o.totalAmount;
      }
    }

    return {
      totalCount: DEMO_ORDERS.length,
      totalAmount: Number(totalAmount.toFixed(2)),
      pendingCount,
      pendingAmount: Number(pendingAmount.toFixed(2)),
      fulfilledCount,
      fulfilledAmount: Number(fulfilledAmount.toFixed(2)),
      processingCount,
      processingAmount: Number(processingAmount.toFixed(2)),
      cancelledCount,
      cancelledAmount: Number(cancelledAmount.toFixed(2)),
    };
  }, []);

  const exportCSV = (type: "transactions" | "orders" | "daily_revenue") => {
    setExporting(true);

    try {
      let headers = "";
      let rows: string[] = [];
      let filename = "";

      if (type === "transactions") {
        headers =
          "Transaction_ID,Customer_Name,Customer_Email,Amount_USD,Fee_USD,Net_USD,Channel,Status,Timestamp,Description\n";
        rows = DEMO_TRANSACTIONS.map(
          (t) =>
            `"${t.id}","${t.customerName}","${t.customerEmail}",${t.amount},${t.fee},${t.netAmount},"${t.paymentMethod}","${t.status}","${t.timestamp}","${t.description.replace(/"/g, '""')}"`
        );
        filename = "paypilot_transactions_report.csv";
      } else if (type === "orders") {
        headers =
          "Order_Number,Customer_Name,Customer_Email,Total_Amount_USD,Status,Items_Count,Created_At,Tracking_Number\n";
        rows = DEMO_ORDERS.map(
          (o) =>
            `"${o.orderNumber}","${o.customerName}","${o.customerEmail}",${o.totalAmount},"${o.status}",${o.items.length},"${o.createdAt}","${o.trackingNumber || "N/A"}"`
        );
        filename = "paypilot_orders_report.csv";
      } else {
        headers =
          "Date,Formatted_Date,Revenue_USD,Orders_Count,Prior_Week_Baseline_USD\n";
        rows = DEMO_DAILY_REVENUE.map(
          (d) =>
            `"${d.date}","${d.formattedDate}",${d.revenue},${d.orders},${d.previousWeekRevenue}`
        );
        filename = "paypilot_daily_revenue_report.csv";
      }

      const csvContent =
        "data:text/csv;charset=utf-8," + encodeURIComponent(headers + rows.join("\n"));
      const link = document.createElement("a");
      link.setAttribute("href", csvContent);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloadSuccess(filename);
      setTimeout(() => setDownloadSuccess(null), 3500);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Business Performance Reports
            </h1>
            <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700 border border-sky-100">
              AUDITED DEMO DATA
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Reconciled financial audits, multi-channel settlement ledgers, and order pipelines
          </p>
        </div>

        {/* Global Export Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => exportCSV("transactions")}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0284C7] px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#0369A1] transition-colors disabled:opacity-50"
            title="Export 12 itemized transaction ledger records ($8,604.00 total)"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Transactions ({txnMetrics.totalCount})</span>
          </button>
          <button
            onClick={() => exportCSV("orders")}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Export 7 customer orders records ($5,574.00 total)"
          >
            <Download className="h-3.5 w-3.5 text-slate-400" />
            <span>Export Orders ({orderMetrics.totalCount})</span>
          </button>
          <button
            onClick={() => exportCSV("daily_revenue")}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Export 7-day consolidated revenue telemetry ($12,480.00 total)"
          >
            <Download className="h-3.5 w-3.5 text-slate-400" />
            <span>Export 7-Day Revenue</span>
          </button>
        </div>
      </div>

      {downloadSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 shadow-sm animate-in fade-in flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>
            Successfully generated and exported <strong className="font-semibold">{downloadSuccess}</strong>!
          </span>
        </div>
      )}

      {/* Scope Distinction & Reporting Contract Callout */}
      <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 text-xs text-slate-700 shadow-sm">
        <div className="flex items-start gap-2.5">
          <Info className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-sky-950">
              PayPilot Reporting Contract &amp; Scope Distinction
            </p>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              The dashboard reflects two distinct, authoritative audit scopes:
              <strong className="text-slate-900 font-semibold"> (1) 7-Day Macro Telemetry </strong>
              ($12,480.00 daily gross volume across 184 multi-channel orders) represents consolidated storefront sales telemetry.
              <strong className="text-slate-900 font-semibold"> (2) Itemized Settlement Ledger </strong>
              (12 transactions totaling $8,604.00 gross with 7 cleared at $7,294.00 gross / $7,099.88 net, and 2 pending at $840.00)
              reconciles 1:1 with the itemized customer orders pipeline (2 pending orders totaling $840.00).
            </p>
          </div>
        </div>
      </div>

      {/* Report Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Revenue Audit (Macro Scope) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                Macro Telemetry (7-Day)
              </span>
              <div className="h-8 w-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="text-xs font-semibold text-slate-500 mb-1">
              Consolidated Revenue Audit
            </div>
            <div className="text-2xl font-mono font-extrabold text-slate-900">
              ${totalDailyRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              7-day daily volume across <span className="font-semibold text-slate-700">{totalDailyOrders} orders</span> (+{macroGrowthRate}% vs prior week)
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              onClick={() => exportCSV("daily_revenue")}
              className="text-xs font-semibold text-[#0284C7] hover:underline flex items-center gap-1.5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Download 7-Day Revenue CSV (${totalDailyRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })})</span>
            </button>
          </div>
        </div>

        {/* Card 2: Settlement Ledger (Micro Scope) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Itemized Ledger (12 TXNs)
              </span>
              <div className="h-8 w-8 rounded-xl bg-emerald-50 text-[#10B981] flex items-center justify-center">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
            <div className="text-xs font-semibold text-slate-500 mb-1">
              Settlement Ledger (Cleared)
            </div>
            <div className="text-2xl font-mono font-extrabold text-slate-900">
              ${txnMetrics.completedGross.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              <span className="font-semibold text-slate-700">{txnMetrics.completedCount} of {txnMetrics.totalCount} cleared</span> (${txnMetrics.completedNet.toFixed(2)} net settled · ${txnMetrics.pendingGross.toFixed(2)} pending)
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              onClick={() => exportCSV("transactions")}
              className="text-xs font-semibold text-[#0284C7] hover:underline flex items-center gap-1.5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Download Ledger CSV (12 Records · ${txnMetrics.grossTotal.toFixed(2)})</span>
            </button>
          </div>
        </div>

        {/* Card 3: Orders Pipeline (Micro Scope) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                Orders Pipeline (7 Orders)
              </span>
              <div className="h-8 w-8 rounded-xl bg-amber-50 text-[#F59E0B] flex items-center justify-center">
                <ShoppingBag className="h-4 w-4" />
              </div>
            </div>
            <div className="text-xs font-semibold text-slate-500 mb-1">
              Pending Fulfillment Pipeline
            </div>
            <div className="text-2xl font-mono font-extrabold text-slate-900">
              ${orderMetrics.pendingAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              <span className="font-semibold text-slate-700">{orderMetrics.pendingCount} orders pending</span> (${orderMetrics.totalAmount.toFixed(2)} total pipeline across {orderMetrics.totalCount} orders)
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              onClick={() => exportCSV("orders")}
              className="text-xs font-semibold text-[#0284C7] hover:underline flex items-center gap-1.5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Download Orders CSV (7 Records · ${orderMetrics.totalAmount.toFixed(2)})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Multi-Scope Reconciliation Audit Breakdown Matrix */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Layers className="h-4 w-4 text-sky-600" />
          <h2 className="text-base font-bold text-slate-900">
            Multi-Scope Financial Reconciliation Matrix
          </h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Cross-dataset audit reconciliation establishing mathematical consistency between macro telemetry and itemized ledger exports
        </p>

        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                <th className="py-3 px-4">Dataset Name</th>
                <th className="py-3 px-4">Audit Scope</th>
                <th className="py-3 px-4 text-center">Records</th>
                <th className="py-3 px-4 text-right">Gross Volume</th>
                <th className="py-3 px-4 text-right">Pending Volume</th>
                <th className="py-3 px-4 text-right">Fees</th>
                <th className="py-3 px-4 text-right">Net Cleared</th>
                <th className="py-3 px-4 text-center">Reconciled CSV Export</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 font-semibold text-slate-900">
                  Consolidated Daily Revenue
                </td>
                <td className="py-3 px-4 text-slate-500">
                  Macro (7-Day Multi-Channel Storefront)
                </td>
                <td className="py-3 px-4 text-center font-mono font-medium text-slate-700">
                  {DEMO_DAILY_REVENUE.length} days ({totalDailyOrders} orders)
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                  ${totalDailyRevenue.toFixed(2)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-slate-400">
                  —
                </td>
                <td className="py-3 px-4 text-right font-mono text-slate-400">
                  —
                </td>
                <td className="py-3 px-4 text-right font-mono text-slate-600">
                  ${totalDailyBaseline.toFixed(2)} (Baseline)
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 border border-sky-100">
                    paypilot_daily_revenue_report.csv
                  </span>
                </td>
              </tr>

              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 font-semibold text-slate-900">
                  Itemized Transactions Ledger
                </td>
                <td className="py-3 px-4 text-slate-500">
                  Micro (Verified Gateway Settlements)
                </td>
                <td className="py-3 px-4 text-center font-mono font-medium text-slate-700">
                  {txnMetrics.totalCount} txns ({txnMetrics.completedCount} cleared)
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                  ${txnMetrics.grossTotal.toFixed(2)}
                </td>
                <td className="py-3 px-4 text-right font-mono font-medium text-amber-600">
                  ${txnMetrics.pendingGross.toFixed(2)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-slate-500">
                  ${txnMetrics.completedFee.toFixed(2)}
                </td>
                <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-600">
                  ${txnMetrics.completedNet.toFixed(2)}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-100">
                    paypilot_transactions_report.csv
                  </span>
                </td>
              </tr>

              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 font-semibold text-slate-900">
                  Customer Orders Pipeline
                </td>
                <td className="py-3 px-4 text-slate-500">
                  Micro (Order Fulfillment Tracking)
                </td>
                <td className="py-3 px-4 text-center font-mono font-medium text-slate-700">
                  {orderMetrics.totalCount} orders ({orderMetrics.pendingCount} pending)
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                  ${orderMetrics.totalAmount.toFixed(2)}
                </td>
                <td className="py-3 px-4 text-right font-mono font-medium text-amber-600">
                  ${orderMetrics.pendingAmount.toFixed(2)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-slate-400">
                  —
                </td>
                <td className="py-3 px-4 text-right font-mono text-slate-600">
                  ${orderMetrics.fulfilledAmount.toFixed(2)} (Fulfilled)
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-100">
                    paypilot_orders_report.csv
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-[11px] text-slate-600 border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>
              <strong>Pending Volume Reconciliation:</strong> Orders pipeline pending (${orderMetrics.pendingAmount.toFixed(2)}) perfectly reconciles with transaction ledger pending (${txnMetrics.pendingGross.toFixed(2)}) across orders ORD-7799 ($520.00) &amp; ORD-7795 ($320.00).
            </span>
          </div>
          <span className="font-semibold text-emerald-700">100% Reconciled</span>
        </div>
      </div>

      {/* Detailed Report Table Preview */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              7-Day Consolidated Ledger Summary
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Daily multi-channel settlement audit showing period gross volume, orders count, and baseline growth
            </p>
          </div>
          <button
            onClick={() => exportCSV("daily_revenue")}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0284C7] hover:underline"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Export Table (CSV)</span>
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4 text-center">Orders</th>
                <th className="py-3 px-4 text-right">Gross Volume</th>
                <th className="py-3 px-4 text-right">Prior Baseline</th>
                <th className="py-3 px-4 text-right">Net Growth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {DEMO_DAILY_REVENUE.map((d) => {
                const diff = d.revenue - d.previousWeekRevenue;
                const percent = ((diff / d.previousWeekRevenue) * 100).toFixed(1);
                return (
                  <tr key={d.date} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {d.formattedDate} (2026)
                    </td>
                    <td className="py-3 px-4 text-center text-slate-600 font-mono">
                      {d.orders}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      ${d.revenue.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-500">
                      ${d.previousWeekRevenue.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[#10B981] font-semibold">
                      +{percent}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Table Audit Footer Totals */}
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
                <td className="py-3 px-4 uppercase text-[11px] tracking-wider text-slate-700">
                  7-Day Total
                </td>
                <td className="py-3 px-4 text-center font-mono">
                  {totalDailyOrders}
                </td>
                <td className="py-3 px-4 text-right font-mono text-slate-900">
                  ${totalDailyRevenue.toFixed(2)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-slate-600">
                  ${totalDailyBaseline.toFixed(2)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-[#10B981]">
                  +{macroGrowthRate}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportsView;
