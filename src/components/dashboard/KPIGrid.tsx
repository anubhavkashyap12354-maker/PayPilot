"use client";

import React from "react";
import {
  DollarSign,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  Percent,
} from "lucide-react";
import { DEMO_KPI_METRICS } from "@/lib/demo-data";

export const KPIGrid: React.FC = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Revenue Card */}
      <div className="group rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total Revenue
          </span>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 group-hover:scale-105 transition-transform">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            ${DEMO_KPI_METRICS.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-[#10B981]">
              <TrendingUp className="h-3 w-3" />
              +{DEMO_KPI_METRICS.revenueGrowth}%
            </span>
            <span className="text-slate-400">vs previous 7 days</span>
          </div>
        </div>
      </div>

      {/* 2. Successful Payments Card */}
      <div className="group rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Successful Payments
          </span>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#10B981] group-hover:scale-105 transition-transform">
            <CheckCircle className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {DEMO_KPI_METRICS.successfulPayments}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-[#10B981]">
              <Percent className="h-3 w-3" />
              {DEMO_KPI_METRICS.successRate}%
            </span>
            <span className="text-slate-400">settlement conversion</span>
          </div>
        </div>
      </div>

      {/* 3. Pending Orders Card */}
      <div className="group rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Pending Orders
          </span>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-[#F59E0B] group-hover:scale-105 transition-transform">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {DEMO_KPI_METRICS.pendingOrders}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-[#F59E0B]">
              ${DEMO_KPI_METRICS.pendingAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-slate-400">pipeline volume</span>
          </div>
        </div>
      </div>

      {/* 4. Failed Payments Card */}
      <div className="group rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Failed Payments
          </span>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 group-hover:scale-105 transition-transform">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {DEMO_KPI_METRICS.failedPayments}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
            <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-600">
              1.6%
            </span>
            <span className="text-slate-400">requires retry review</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KPIGrid;
