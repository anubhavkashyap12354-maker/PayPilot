"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Transaction, PaymentStatus } from "@/types";
import { CheckCircle2, Clock, XCircle, PieChart as PieChartIcon } from "lucide-react";

interface PaymentStatusChartProps {
  transactions: Transaction[];
}

interface StatusSlice {
  name: string;
  key: PaymentStatus;
  count: number;
  percentage: number;
  amount: number;
  color: string;
}

const STATUS_CONFIG: Record<
  PaymentStatus,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  completed: {
    label: "Completed",
    color: "#10B981", // Emerald 500
    icon: CheckCircle2,
  },
  pending: {
    label: "Pending",
    color: "#F59E0B", // Amber 500
    icon: Clock,
  },
  failed: {
    label: "Failed",
    color: "#EF4444", // Red 500
    icon: XCircle,
  },
  refunded: {
    label: "Refunded",
    color: "#8B5CF6", // Purple 500
    icon: XCircle,
  },
};

interface TooltipPayloadItem {
  payload: StatusSlice;
}

const CustomStatusTooltip: React.FC<{
  active?: boolean;
  payload?: TooltipPayloadItem[];
}> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm text-xs">
        <p className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: data.color }}
          />
          {data.name}
        </p>
        <div className="space-y-1">
          <p className="flex items-center justify-between gap-4 text-slate-600">
            <span>Transaction Count:</span>
            <span className="font-bold text-slate-900">{data.count}</span>
          </p>
          <p className="flex items-center justify-between gap-4 text-slate-600">
            <span>Share:</span>
            <span className="font-bold text-slate-900">{data.percentage.toFixed(1)}%</span>
          </p>
          <p className="flex items-center justify-between gap-4 text-slate-500 pt-1 border-t border-slate-100">
            <span>Total Value:</span>
            <span className="font-semibold text-slate-700">
              ${data.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export const PaymentStatusChart: React.FC<PaymentStatusChartProps> = ({ transactions }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { chartData, totalCount } = useMemo(() => {
    const total = transactions.length;

    // Track completed, pending, failed
    const counts: Record<"completed" | "pending" | "failed", { count: number; amount: number }> = {
      completed: { count: 0, amount: 0 },
      pending: { count: 0, amount: 0 },
      failed: { count: 0, amount: 0 },
    };

    transactions.forEach((t) => {
      if (t.status === "completed" || t.status === "pending" || t.status === "failed") {
        counts[t.status].count += 1;
        counts[t.status].amount += Number(t.amount) || 0;
      }
    });

    const orderedKeys: PaymentStatus[] = ["completed", "pending", "failed"];

    const data: StatusSlice[] = orderedKeys.map((key) => {
      const cfg = STATUS_CONFIG[key];
      const count = counts[key as keyof typeof counts].count;
      const amount = counts[key as keyof typeof counts].amount;
      const percentage = total > 0 ? (count / total) * 100 : 0;

      return {
        name: cfg.label,
        key,
        count,
        percentage,
        amount,
        color: cfg.color,
      };
    });

    return { chartData: data, totalCount: total };
  }, [transactions]);

  // Slices with count > 0 for rendering the pie chart arcs cleanly
  const activeSlices = useMemo(
    () => chartData.filter((d) => d.count > 0),
    [chartData]
  );

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Payment Status Distribution</h2>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2.5 py-0.5">
            {totalCount} Total
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Distribution across completed, pending, and failed transactions
        </p>
      </div>

      {totalCount === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400">
          <PieChartIcon className="h-8 w-8 mb-2 stroke-1" />
          <p className="text-xs font-medium">No transaction records available</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="h-56 w-full relative">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomStatusTooltip />} />
                  <Pie
                    data={activeSlices}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    isAnimationActive={false}
                  >
                    {activeSlices.map((slice) => (
                      <Cell key={`cell-${slice.key}`} fill={slice.color} stroke="#ffffff" strokeWidth={2} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
                Loading chart...
              </div>
            )}
            {/* Center label inside donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-slate-900">{totalCount}</span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Records
              </span>
            </div>
          </div>

          {/* Custom Status Legend with Counts & Percentages */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
            {chartData.map((item) => {
              const Icon = STATUS_CONFIG[item.key].icon;
              return (
                <div
                  key={item.key}
                  className="p-2 rounded-xl bg-slate-50/70 border border-slate-100 flex flex-col items-center text-center"
                >
                  <div className="flex items-center gap-1 mb-0.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs font-medium text-slate-700">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900">{item.count}</span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
