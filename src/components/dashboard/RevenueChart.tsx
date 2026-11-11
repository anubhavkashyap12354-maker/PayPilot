"use client";

import React, { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { DEMO_DAILY_REVENUE } from "@/lib/demo-data";
import { ArrowUpRight, Calendar } from "lucide-react";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    color: string;
  }>;
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm text-xs">
        <p className="font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          {label}
        </p>
        <div className="space-y-1">
          <p className="flex items-center justify-between gap-4 font-semibold text-sky-700">
            <span>Current Revenue:</span>
            <span className="font-extrabold">${payload[0]?.value?.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </p>
          {payload[1] && (
            <p className="flex items-center justify-between gap-4 text-slate-500">
              <span>Prior Baseline:</span>
              <span className="font-medium">${payload[1]?.value?.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </p>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export const RevenueChart: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [showPriorWeek, setShowPriorWeek] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Revenue Analytics (Last 7 Days)
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-[#10B981]">
              <ArrowUpRight className="h-3 w-3" />
              +14.2%
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Daily gross payment volume from PayPal and integrated payment methods
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#0284C7]" />
            <span className="text-slate-600 font-medium">This Week</span>
          </div>
          <button
            onClick={() => setShowPriorWeek((v) => !v)}
            className={`flex items-center gap-1.5 transition-opacity ${!showPriorWeek ? "opacity-40" : ""}`}
            aria-pressed={showPriorWeek}
            aria-label="Toggle Prior Week Baseline series"
          >
            <span className={`h-2.5 w-2.5 rounded-full ${showPriorWeek ? "bg-slate-300" : "bg-slate-200"}`} />
            <span className={`font-medium ${showPriorWeek ? "text-slate-400" : "text-slate-300 line-through"}`}>
              Prior Week Baseline
            </span>
          </button>
        </div>
      </div>

      <div className="h-72 w-full">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={DEMO_DAILY_REVENUE}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0284C7" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#0284C7" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis
                dataKey="formattedDate"
                tickLine={false}
                axisLine={{ stroke: "#E2E8F0" }}
                tick={{ fill: "#64748B", fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#64748B", fontSize: 11 }}
                tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`}
              />
              <Tooltip content={<CustomTooltip />} />
              {showPriorWeek && (
                <Area
                  type="monotone"
                  dataKey="previousWeekRevenue"
                  name="Prior Week"
                  stroke="#CBD5E1"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fill="none"
                />
              )}
              <Area
                type="monotone"
                dataKey="revenue"
                name="Current Revenue"
                stroke="#0284C7"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#revenueGradient)"
                activeDot={{ r: 6, fill: "#0284C7", stroke: "#FFFFFF", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            Rendering chart...
          </div>
        )}
      </div>
    </div>
  );
};

export default RevenueChart;
