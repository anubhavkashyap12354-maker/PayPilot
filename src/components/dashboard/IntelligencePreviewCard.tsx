"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Lightbulb, AlertCircle } from "lucide-react";

export const IntelligencePreviewCard: React.FC = () => {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-br from-white via-sky-50/30 to-blue-50/50 p-6 shadow-sm">
      {/* Glow decorative accent */}
      <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-sky-200/20 blur-2xl pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm shadow-sky-600/30">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                PayPilot Intelligence
              </h2>
              <span className="text-[11px] font-medium text-sky-700">
                Heuristic & Anomaly Copilot
              </span>
            </div>
          </div>

          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
            DEMO PREVIEW
          </span>
        </div>

        <div className="mt-3 rounded-xl border border-sky-100 bg-white/80 p-4 backdrop-blur-sm">
          <div className="flex items-start gap-2.5">
            <Lightbulb className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              &ldquo;Your demo revenue increased compared with the previous period. Review pending orders to identify transactions that may need attention.&rdquo;
            </p>
          </div>

          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
            <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
            <span>Sample insight synthesized from local demo data (no external AI call).</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Grounded in verified store records
          </div>
          <Link
            href="/ai-copilot"
            className="inline-flex items-center gap-2 rounded-xl bg-[#0284C7] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#0369A1] transition-colors"
          >
            <span>Open AI Command Centre</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default IntelligencePreviewCard;
