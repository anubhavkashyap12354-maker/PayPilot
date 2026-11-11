"use client";

import React, { useState } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Percent,
  Calendar,
  Layers,
  FileText,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import type { AIStructuredData } from "@/lib/ai/types";
import type { OverdueOrderIssue } from "@/lib/ai/tools/overdue-detector";
import RecommendationCard from "./RecommendationCard";
import ReportPreviewModal from "./ReportPreviewModal";

interface StructuredResponseViewProps {
  data?: AIStructuredData;
  sourceEngine?: string;
}

export const StructuredResponseView: React.FC<StructuredResponseViewProps> = ({
  data,
  sourceEngine,
}) => {
  const [showDailyForecast, setShowDailyForecast] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  if (!data) return null;

  const { revenue, forecast, anomalies, overdue, recommendations } = data;
  const hasAnyData = Boolean(
    revenue || forecast || anomalies || overdue || recommendations
  );

  if (!hasAnyData) return null;

  return (
    <div className="mt-4 space-y-4 pt-3 border-t border-slate-200/80 animate-fadeIn">
      {/* 1. Financial KPI Cards Grid (if revenue analytics present) */}
      {revenue && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-sky-600" />
              Verified Financial KPIs ({revenue.periodDays}-Day Period)
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              Source: {revenue.dataSource}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Gross Volume */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-xs">
              <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                Gross Volume
              </span>
              <span className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 block">
                ${revenue.grossVolume.toLocaleString("en-US", { minimumFractionDigits: 2 })}{" "}
                <span className="text-xs font-normal text-slate-500">{revenue.currency}</span>
              </span>
              {revenue.growthRate !== null && (
                <div className="mt-1 flex items-center gap-1 text-[10px]">
                  <span
                    className={`inline-flex items-center gap-0.5 font-bold ${
                      revenue.growthRate >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {revenue.growthRate >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {revenue.growthRate >= 0 ? "+" : ""}
                    {revenue.growthRate}%
                  </span>
                  <span className="text-slate-400">vs prior period</span>
                </div>
              )}
            </div>

            {/* Net Revenue */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-xs">
              <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                Net Revenue
              </span>
              <span className="text-base sm:text-lg font-bold text-emerald-700 mt-0.5 block">
                ${revenue.netRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Fees: ${revenue.totalFees.toFixed(2)}
              </span>
            </div>

            {/* Conversion Success Rate */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-xs">
              <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                Conversion Rate
              </span>
              <span className="text-base sm:text-lg font-bold text-sky-700 mt-0.5 block">
                {revenue.successRate}%
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">
                {revenue.successfulCount} success / {revenue.failedCount} failed
              </span>
            </div>

            {/* Average Ticket Size */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-xs">
              <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                Avg Ticket Size
              </span>
              <span className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 block">
                ${revenue.averageTransactionValue.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">
                {revenue.pendingCount} order(s) pending
                {revenue.pendingVolume > 0 && (
                  <> · <span className="text-amber-600 font-semibold">${revenue.pendingVolume.toFixed(2)}</span></>
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Forward Cash Flow Forecast Card (if cashflow forecaster present) */}
      {forecast && (
        <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 via-white to-white p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-900">
                Forward Cash Flow Inflow Projection ({forecast.horizonDays}-Day Horizon)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                Model Confidence: {forecast.overallConfidenceScore}%
              </span>
              <button
                onClick={() => setShowDailyForecast(!showDailyForecast)}
                className="text-xs font-semibold text-sky-700 hover:text-sky-800 flex items-center gap-0.5"
              >
                <span>{showDailyForecast ? "Hide Daily" : "Daily Schedule"}</span>
                {showDailyForecast ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
            </div>
          </div>

          {/* Forecast Metric Triplets */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-2">
            <div className="rounded-lg border border-slate-200/90 bg-white p-2.5">
              <span className="text-[10px] font-medium text-slate-500 uppercase block">
                Historical Settled Funds
              </span>
              <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                ${forecast.currentSettledFunds.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-emerald-600 block mt-0.5 font-medium">
                Verified Realized Cash
              </span>
            </div>

            <div className="rounded-lg border border-slate-200/90 bg-white p-2.5">
              <span className="text-[10px] font-medium text-slate-500 uppercase block">
                Pending Pipeline
              </span>
              <span className="text-sm font-bold text-amber-700 mt-0.5 block">
                ${forecast.pendingPipelineAmount.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Across {forecast.pendingOrdersCount} orders
              </span>
            </div>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5">
              <span className="text-[10px] font-semibold text-emerald-800 uppercase block">
                Projected 7-Day Inflows
              </span>
              <span className="text-sm font-extrabold text-emerald-700 mt-0.5 block">
                ${forecast.projected7DayInflowTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-emerald-700 block mt-0.5 font-medium">
                Statistical Projection
              </span>
            </div>
          </div>

          {/* Clear Distinction Notice */}
          <div className="mt-2.5 rounded-md bg-amber-50/70 border border-amber-200/60 p-2 text-[10px] text-amber-800">
            <strong>CRITICAL DISTINCTION: </strong>
            Settled funds ($
            {forecast.currentSettledFunds.toLocaleString("en-US", { minimumFractionDigits: 2 })}) are historical settled facts.
            Projected inflows ($
            {forecast.projected7DayInflowTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}) are forward-looking statistical estimates.{" "}
            Includes an estimated{" "}
            <strong>
              ${(forecast.pendingPipelineAmount * 0.75).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </strong>{" "}
            pipeline conversion (75% of ${forecast.pendingPipelineAmount.toFixed(2)} pending pipeline across {forecast.pendingOrdersCount} orders). This is a statistical estimate, not guaranteed revenue.
          </div>

          {/* Expandable Daily Projections Table */}
          {showDailyForecast && forecast.dailyProjections && (
            <div className="mt-3 overflow-x-auto border-t border-slate-200/80 pt-2 animate-fadeIn">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase text-[9px] font-bold">
                    <th className="py-1">Day / Date</th>
                    <th className="py-1">Projected Inflow</th>
                    <th className="py-1">Scheduled T+1 Clearing</th>
                    <th className="py-1">Pipeline Port</th>
                    <th className="py-1">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {forecast.dailyProjections.map((dp, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-1.5 font-medium text-slate-800">{dp.dayLabel}</td>
                      <td className="py-1.5 font-bold text-emerald-700">
                        ${dp.projectedInflow.toFixed(2)}
                      </td>
                      <td className="py-1.5 text-slate-600">
                        ${dp.settledCarryover.toFixed(2)}
                      </td>
                      <td className="py-1.5 text-amber-600">
                        ${dp.pendingPipelineExpected.toFixed(2)}
                      </td>
                      <td className="py-1.5 text-slate-500 font-semibold">{dp.confidenceScore}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. Risk & Anomaly Alerts (if anomaly detector present) */}
      {anomalies && anomalies.anomalies.length > 0 && (
        <div className="rounded-xl border border-rose-200/80 bg-rose-50/30 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-rose-600" />
              Risk & Payment Anomalies ({anomalies.riskSummary.overallRiskScore.toUpperCase()})
            </span>
            <span className="text-[10px] font-semibold text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-full">
              Decline Rate: {anomalies.riskSummary.declineRatePercentage}%
            </span>
          </div>

          <div className="space-y-1.5">
            {anomalies.anomalies.map((a, i) => (
              <div
                key={i}
                className="rounded-lg border border-rose-200/60 bg-white p-2.5 text-xs text-slate-800 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{a.title}</span>
                  <span
                    className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                      a.severity === "high"
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {a.severity}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-600">{a.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Overdue Orders Card (if overdue detector present) */}
      {overdue && overdue.overdueOrders.length > 0 && (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/30 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-600" />
              Overdue Orders Requiring Follow-up ({overdue.overdueOrdersCount} orders)
            </span>
            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
              ${overdue.totalAtRiskAmount.toFixed(2)} At Risk
            </span>
          </div>

          <div className="space-y-1.5">
            {overdue.overdueOrders.map((o: OverdueOrderIssue, i: number) => (
              <div
                key={i}
                className="rounded-lg border border-amber-200/70 bg-white p-2.5 text-xs text-slate-800 shadow-xs flex items-center justify-between gap-2"
              >
                <div>
                  <span className="font-bold text-slate-900">{o.orderNumber}</span>{" "}
                  <span className="text-slate-500 font-medium">({o.customerNameMasked})</span>
                  <p className="text-[11px] text-slate-600 mt-0.5">{o.reason}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-bold text-slate-900 block">${o.amount.toFixed(2)}</span>
                  <span className="text-[10px] font-semibold text-amber-700">
                    {o.ageHours}h pending
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Prioritized Business Recommendations (Task 3) */}
      {recommendations && recommendations.recommendations.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-sky-600" />
              Prioritized Action Recommendations ({recommendations.totalRecommendations})
            </span>
          </div>

          <div className="space-y-3">
            {recommendations.recommendations.map((rec, i) => (
              <RecommendationCard key={i} recommendation={rec} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* 6. Executive Report Preview Trigger (Task 4) */}
      <div className="pt-2 flex items-center justify-between bg-slate-50/70 border border-slate-200/70 rounded-xl p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 block">
              Executive Business Operations Report
            </span>
            <span className="text-[10px] text-slate-500 block">
              Formatted intelligence summary with CSV export and print view
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsReportOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200/90 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-sky-300 hover:bg-sky-50/50 hover:text-sky-800 shadow-xs transition-colors"
        >
          <span>View Report Preview</span>
          <ArrowRight className="h-3.5 w-3.5 text-sky-600" />
        </button>
      </div>

      {/* Report Modal */}
      <ReportPreviewModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        data={data}
        sourceEngine={sourceEngine}
      />
    </div>
  );
};

export default StructuredResponseView;
