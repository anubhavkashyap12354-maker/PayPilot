"use client";

import React from "react";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Zap,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  BrainCircuit,
  Info,
} from "lucide-react";
import { DEMO_INSIGHTS, DEMO_DAILY_REVENUE } from "@/lib/demo-data";
import Link from "next/link";

export default function IntelligencePage() {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-sky-200/80 bg-gradient-to-r from-sky-50 via-white to-blue-50/40 p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              PayPilot Intelligence
            </h1>
            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800 border border-sky-200">
              DEMO PREVIEW ENGINE
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1 max-w-xl">
            Heuristic intelligence synthesizing payment patterns, anomaly discovery, and revenue forecasts. All metrics are fictional previews calibrated for Phase 1.
          </p>
        </div>

        <Link
          href="/ai-copilot"
          className="inline-flex items-center gap-2 rounded-xl bg-[#0284C7] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#0369A1] transition-colors self-start sm:self-auto"
        >
          <Sparkles className="h-4 w-4" />
          <span>Launch AI Command Centre</span>
        </Link>
      </div>

      {/* Disclaimers & Engine Info */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/50 p-4 text-xs text-amber-900">
        <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p>
          <strong>Notice:</strong> Insights shown on this page are deterministic demo previews derived from local sample transactions and heuristic rules. They demonstrate future copilot telemetry before live LLM and external inference endpoints are linked in Phase 2.
        </p>
      </div>

      {/* Grid of Key Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DEMO_INSIGHTS.map((insight) => (
          <div
            key={insight.id}
            className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  {insight.category}
                </span>

                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400">Confidence:</span>
                  <span className="font-bold text-sky-700">{insight.confidenceScore}%</span>
                </div>
              </div>

              <h2 className="text-sm font-bold text-slate-900 mb-1">
                {insight.title}
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                {insight.summary}
              </p>

              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs text-slate-700">
                <span className="font-semibold text-slate-800">Heuristic Analysis: </span>
                <span>{insight.detailedAnalysis}</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-sky-700">
                Action: {insight.suggestedAction}
              </span>
              {insight.actionUrl && (
                <Link
                  href={insight.actionUrl}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-800"
                >
                  <span>Resolve</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Anomaly Detection & Forecasting Previews */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Anomaly Detection Preview */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">
                Anomaly Detection Radar (Preview)
              </h2>
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-[#10B981]">
              HEALTHY SYSTEM
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-slate-800">Payment Velocity Spike</span>
                <span className="text-emerald-600 font-semibold">Normal (28/hr peak)</span>
              </div>
              <p className="text-slate-500 text-[11px]">
                No rapid automated card testing bots detected across checkout endpoints.
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-slate-800">Decline Clustered By BIN</span>
                <span className="text-amber-600 font-semibold">2 Soft Declines</span>
              </div>
              <p className="text-slate-500 text-[11px]">
                Isolated bank limits for international customers; no merchant account block.
              </p>
            </div>
          </div>
        </div>

        {/* Forecasting Preview */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                <TrendingUp className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">
                Cash Flow Forecasting (7-Day Projection)
              </h2>
            </div>
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
              PROJECTED: $14.1K
            </span>
          </div>

          <div className="space-y-3 text-xs text-slate-600">
            <p className="leading-relaxed">
              Based on historical 7-day run-rate ($12,480.00) and scheduled subscription renewal cohorts:
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="text-[11px] text-slate-400">Projected Run Rate</span>
                <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">$14,100.00</div>
                <span className="text-[10px] text-emerald-600 font-semibold">+13.0% forecast</span>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="text-[11px] text-slate-400">Expected Payouts</span>
                <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">$13,680.00</div>
                <span className="text-[10px] text-slate-500">T+1 automated clearing</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
