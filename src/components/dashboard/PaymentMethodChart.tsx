"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Transaction } from "@/types";
import { CreditCard, BarChart3 } from "lucide-react";

interface PaymentMethodChartProps {
  transactions: Transaction[];
}

interface MethodItem {
  method: string;
  label: string;
  count: number;
  percentage: number;
  amount: number;
  color: string;
}

const METHOD_LABELS: Record<string, { label: string; color: string }> = {
  card: { label: "Credit / Debit Card", color: "#0284C7" }, // Sky 600
  paypal: { label: "PayPal", color: "#0070BA" }, // PayPal Classic Blue
  bank_transfer: { label: "Bank Transfer", color: "#0D9488" }, // Teal 600
  apple_pay: { label: "Apple Pay", color: "#475569" }, // Slate 600
  other: { label: "Other", color: "#94A3B8" }, // Slate 400
};

interface TooltipPayloadItem {
  payload: MethodItem;
}

const CustomMethodTooltip: React.FC<{
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
          {data.label}
        </p>
        <div className="space-y-1">
          <p className="flex items-center justify-between gap-4 text-slate-600">
            <span>Transaction Count:</span>
            <span className="font-bold text-slate-900">{data.count}</span>
          </p>
          <p className="flex items-center justify-between gap-4 text-slate-600">
            <span>Share of Transactions:</span>
            <span className="font-bold text-slate-900">{data.percentage.toFixed(1)}%</span>
          </p>
          <p className="flex items-center justify-between gap-4 text-slate-500 pt-1 border-t border-slate-100">
            <span>Aggregated Volume:</span>
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

export const PaymentMethodChart: React.FC<PaymentMethodChartProps> = ({ transactions }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { chartData, totalCount } = useMemo(() => {
    const total = transactions.length;

    const aggregation: Record<string, { count: number; amount: number }> = {};

    transactions.forEach((t) => {
      const methodKey = t.paymentMethod || "other";
      if (!aggregation[methodKey]) {
        aggregation[methodKey] = { count: 0, amount: 0 };
      }
      aggregation[methodKey].count += 1;
      aggregation[methodKey].amount += Number(t.amount) || 0;
    });

    // Sort methods by count descending
    const items: MethodItem[] = Object.keys(aggregation)
      .map((key) => {
        const meta = METHOD_LABELS[key] || {
          label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          color: METHOD_LABELS.other.color,
        };
        const count = aggregation[key].count;
        const amount = aggregation[key].amount;
        const percentage = total > 0 ? (count / total) * 100 : 0;

        return {
          method: key,
          label: meta.label,
          count,
          percentage,
          amount,
          color: meta.color,
        };
      })
      .sort((a, b) => b.count - a.count);

    return { chartData: items, totalCount: total };
  }, [transactions]);

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Payment Method Breakdown</h2>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2.5 py-0.5">
            {chartData.length} Methods
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Distribution of transactions by buyer payment method
        </p>
      </div>

      {totalCount === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400">
          <BarChart3 className="h-8 w-8 mb-2 stroke-1" />
          <p className="text-xs font-medium">No transaction records available</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Horizontal Bar Chart */}
          <div className="h-56 w-full">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <XAxis
                    type="number"
                    domain={[0, "dataMax + 1"]}
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#64748B" }}
                    axisLine={{ stroke: "#E2E8F0" }}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="label"
                    type="category"
                    width={110}
                    tick={{ fontSize: 11, fill: "#334155", fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomMethodTooltip />} cursor={{ fill: "#F1F5F9", opacity: 0.7 }} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} isAnimationActive={false}>
                    {chartData.map((entry) => (
                      <Cell key={`bar-${entry.method}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
                Loading chart...
              </div>
            )}
          </div>

          {/* Method Count & Percentage Summary List */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
            {chartData.map((item) => (
              <div
                key={item.method}
                className="p-2 rounded-xl bg-slate-50/70 border border-slate-100 flex flex-col"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs font-medium text-slate-700 truncate" title={item.label}>
                    {item.label}
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-auto">
                  <span className="text-sm font-bold text-slate-900">{item.count} txns</span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
