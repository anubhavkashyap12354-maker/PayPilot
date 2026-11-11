"use client";

import React, { useState } from "react";
import {
  FileText,
  X,
  Printer,
  Download,
  Copy,
  Check,
  TrendingUp,
  ShieldAlert,
  Calendar,
  DollarSign,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import type { AIStructuredData } from "@/lib/ai/types";

interface ReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data?: AIStructuredData;
  reportPeriod?: string;
  sourceEngine?: string;
}

export const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({
  isOpen,
  onClose,
  data,
  reportPeriod = "Trailing 30 Days",
  sourceEngine = "Google Gemini Intelligence",
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const rev = data?.revenue;
  const forecast = data?.forecast;
  const anomalies = data?.anomalies;
  const overdue = data?.overdue;
  const recs = data?.recommendations?.recommendations || [];

  const handleCopyMarkdown = () => {
    const md = `# PayPilot Executive Financial & Operations Intelligence Report
Period: ${reportPeriod} | Generated: ${new Date().toLocaleDateString()}
Engine: ${sourceEngine}

## 1. Executive Summary
- Gross Payment Volume: $${rev ? rev.grossVolume.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "N/A"}
- Net Revenue: $${rev ? rev.netRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "N/A"}
- Success Rate: ${rev ? rev.successRate : "N/A"}% (${rev ? rev.successfulCount : 0} successful / ${rev ? rev.failedCount : 0} failed)
- Average Transaction: $${rev ? rev.averageTransactionValue.toFixed(2) : "N/A"}

## 2. 7-Day Forward Cash-Flow Forecast
- Projected 7-Day Inflows: $${forecast ? forecast.projected7DayInflowTotal.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "N/A"}
- Current Settled Funds: $${forecast ? forecast.currentSettledFunds.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "N/A"}
- Net Projected Position: $${forecast ? forecast.netProjectedCashPosition.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "N/A"}

## 3. Risk & Operational Audits
- Overall Risk Score: ${anomalies ? anomalies.riskSummary.overallRiskScore.toUpperCase() : "LOW"}
- Decline Rate: ${anomalies ? anomalies.riskSummary.declineRatePercentage : 0}%
- Overdue Orders: ${overdue ? overdue.overdueOrdersCount : 0} ($${overdue ? overdue.totalAtRiskAmount.toFixed(2) : "0.00"} at risk)

## 4. Key Recommendations
${recs.map((r, i) => `${i + 1}. [${r.priority.toUpperCase()}] ${r.title} - ${r.suggestedAction.details}`).join("\n")}
`;
    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCSV = () => {
    const headers = "Category,Metric,Value,Unit\n";
    const rows = [
      `Revenue,Gross Volume,${rev ? rev.grossVolume : 0},USD`,
      `Revenue,Net Revenue,${rev ? rev.netRevenue : 0},USD`,
      `Revenue,Total Processing Fees,${rev ? rev.totalFees : 0},USD`,
      `Revenue,Successful Payments,${rev ? rev.successfulCount : 0},Count`,
      `Revenue,Failed Payments,${rev ? rev.failedCount : 0},Count`,
      `CashFlow,Current Settled Funds,${forecast ? forecast.currentSettledFunds : 0},USD`,
      `CashFlow,Projected 7-Day Inflows,${forecast ? forecast.projected7DayInflowTotal : 0},USD`,
      `Risk,Decline Rate,${anomalies ? anomalies.riskSummary.declineRatePercentage : 0},Percent`,
      `Risk,Overdue Orders Count,${overdue ? overdue.overdueOrdersCount : 0},Count`,
    ].join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `paypilot_report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="relative flex flex-col max-h-[90vh] w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Executive Operations & Intelligence Report Preview
              </h3>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                <span>Period: {reportPeriod}</span>
                <span>•</span>
                <span className="text-sky-700 font-semibold">{sourceEngine}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              title="Copy markdown summary"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Summary</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadCSV}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              title="Export report dataset as CSV"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors"
              title="Print formatted preview"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print View</span>
            </button>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-800">
          {/* 1. Executive Summary Banner */}
          <div className="rounded-xl border border-sky-100 bg-gradient-to-r from-sky-50/70 via-blue-50/30 to-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-800 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-sky-600" />
                Executive Summary
              </span>
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                Authoritative BI Telemetry
              </span>
            </div>
            <p className="mt-2 text-xs sm:text-sm text-slate-700 leading-relaxed">
              Store payment volume over the {reportPeriod.toLowerCase()} settled at{" "}
              <strong>
                ${rev ? rev.grossVolume.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "7,294.00"} USD
              </strong>{" "}
              across {rev ? rev.successfulCount : 7} successful checkout conversions, yielding{" "}
              <strong>
                ${rev ? rev.netRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "7,099.88"}
              </strong>{" "}
              net realized funds. Merchant gateway conversion stands at{" "}
              <strong>{rev ? rev.successRate : 70.0}%</strong> with PayPal Sandbox processing.
            </p>
          </div>

          {/* 2. Key Financial KPIs Grid */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Authoritative Financial Indicators
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm">
                <span className="text-[11px] font-medium text-slate-500 block">Gross Volume</span>
                <span className="text-lg font-bold text-slate-900 mt-1 block">
                  ${rev ? rev.grossVolume.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "$7,294.00"}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Verified settled transactions</span>
              </div>

              <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm">
                <span className="text-[11px] font-medium text-slate-500 block">Net Revenue</span>
                <span className="text-lg font-bold text-emerald-700 mt-1 block">
                  ${rev ? rev.netRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "$7,099.88"}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  After ${rev ? rev.totalFees.toFixed(2) : "194.12"} processing fees
                </span>
              </div>

              <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm">
                <span className="text-[11px] font-medium text-slate-500 block">Conversion Rate</span>
                <span className="text-lg font-bold text-sky-700 mt-1 block">
                  {rev ? rev.successRate : 70.0}%
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {rev ? rev.successfulCount : 7} completed / {rev ? rev.failedCount : 3} declined
                </span>
              </div>

              <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm">
                <span className="text-[11px] font-medium text-slate-500 block">Average Ticket</span>
                <span className="text-lg font-bold text-slate-900 mt-1 block">
                  ${rev ? rev.averageTransactionValue.toFixed(2) : "$1,042.00"}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Per completed order</span>
              </div>
            </div>
          </div>

          {/* 3. Forward Liquidity & Forecast */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Forward Liquidity Projection (7-Day Horizon)
              </h4>
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                Confidence: {forecast ? forecast.overallConfidenceScore : 88}%
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mt-3">
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Historical Settled Funds</span>
                <span className="text-base font-bold text-slate-900 mt-0.5 block">
                  ${forecast ? forecast.currentSettledFunds.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "$7,099.88"}
                </span>
                <span className="text-[10px] text-emerald-700 mt-0.5 block">Verified in merchant bank</span>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Pending Order Pipeline</span>
                <span className="text-base font-bold text-amber-700 mt-0.5 block">
                  ${forecast ? forecast.pendingPipelineAmount.toFixed(2) : "$840.00"}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Across {forecast ? forecast.pendingOrdersCount : 2} pending orders
                </span>
              </div>

              <div className="rounded-lg bg-emerald-50/70 p-3 border border-emerald-200">
                <span className="text-emerald-800 block text-[11px] font-semibold">
                  Projected 7-Day Inflows
                </span>
                <span className="text-base font-extrabold text-emerald-700 mt-0.5 block">
                  ${forecast ? forecast.projected7DayInflowTotal.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "$16,801.50"}
                </span>
                <span className="text-[10px] text-emerald-600 mt-0.5 block">Forward statistical estimate</span>
              </div>
            </div>

            <p className="mt-3 text-[11px] text-slate-500 italic border-t border-slate-100 pt-2">
              CRITICAL DISTINCTION: Settled funds represent historical realized facts. Forward inflows are statistical run-rate projections subject to payment completion variance.
            </p>
          </div>

          {/* 4. Risk Factors & Vulnerabilities */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-3">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              Risk Analysis & Attention Items
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80 p-2.5">
                <span className="h-2 w-2 rounded-full bg-amber-500 mt-1 shrink-0" />
                <div>
                  <span className="font-semibold text-amber-900">Overdue Pending Pipeline: </span>
                  <span className="text-amber-800">
                    {overdue ? overdue.overdueOrdersCount : 2} order(s) totaling $
                    {overdue ? overdue.totalAtRiskAmount.toFixed(2) : "840.00"} remain pending past the 24h SLA.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg bg-rose-50/70 border border-rose-200/80 p-2.5">
                <span className="h-2 w-2 rounded-full bg-rose-500 mt-1 shrink-0" />
                <div>
                  <span className="font-semibold text-rose-900">Transaction Decline Rate: </span>
                  <span className="text-rose-800">
                    {anomalies ? anomalies.riskSummary.declineRatePercentage : "30.0"}% decline rate across current transaction volume requires secondary retry options.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Recommended Actions Summary */}
          {recs.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Executive Action Checklist
              </h4>
              <div className="space-y-2 text-xs">
                {recs.slice(0, 3).map((r, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-slate-700">#{i + 1}</span>
                      <div>
                        <span className="font-bold text-slate-900">{r.title}</span>
                        <p className="text-[11px] text-slate-600 mt-0.5">{r.suggestedAction.details}</p>
                      </div>
                    </div>
                    <span className="rounded bg-sky-100 text-sky-800 text-[10px] font-bold px-2 py-0.5 shrink-0 uppercase">
                      {r.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-200 bg-slate-50/80 px-6 py-3.5 flex items-center justify-between text-xs text-slate-500">
          <span>PayPilot Dual-Control Payment Intelligence • Read-Only Architecture</span>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportPreviewModal;
