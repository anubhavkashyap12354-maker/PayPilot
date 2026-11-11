"use client";

import React, { useMemo } from "react";
import { Sparkles, Calendar, ArrowUpRight } from "lucide-react";
import Link from "next/link";

export const WelcomeBanner: React.FC = () => {
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const todayFormatted = useMemo(() => {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date());
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
      {/* Decorative gradient overlay */}
      <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-sky-100/40 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700 border border-sky-100">
              <Sparkles className="h-3.5 w-3.5 text-sky-600" />
              DEMO DATA
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              {todayFormatted}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            {greeting}, Business Owner
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-normal">
            Here&apos;s what&apos;s happening with your business today. Fictional telemetry calibrated for Phase 1.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/ai-copilot"
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 transition-colors"
          >
            <span>Ask PayPilot AI</span>
            <ArrowUpRight className="h-4 w-4" />
          </Link>
          <Link
            href="/reports"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span>View Reports</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default WelcomeBanner;
