"use client";

import React from "react";
import {
  CreditCard,
  ShoppingBag,
  AlertCircle,
  ShieldCheck,
  ArrowDownLeft,
  CheckCircle2,
} from "lucide-react";
import { DEMO_ACTIVITIES } from "@/lib/demo-data";
import { Activity } from "@/types";

export const BusinessActivityPanel: React.FC = () => {
  const getIcon = (type: Activity["type"]) => {
    switch (type) {
      case "payment_received":
        return <CheckCircle2 className="h-4 w-4 text-[#10B981]" />;
      case "payment_failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "approval_requested":
        return <ShieldCheck className="h-4 w-4 text-[#F59E0B]" />;
      case "order_created":
        return <ShoppingBag className="h-4 w-4 text-sky-500" />;
      case "payout_processed":
        return <ArrowDownLeft className="h-4 w-4 text-slate-500" />;
      default:
        return <CreditCard className="h-4 w-4 text-slate-500" />;
    }
  };

  const getBadgeStyle = (status?: Activity["status"]) => {
    switch (status) {
      case "success":
        return "bg-emerald-50 text-[#10B981]";
      case "warning":
        return "bg-amber-50 text-[#F59E0B]";
      case "error":
        return "bg-red-50 text-red-600";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Business Activity</h2>
          <p className="text-xs text-slate-500">Live operational event telemetry</p>
        </div>
        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
      </div>

      <div className="space-y-4">
        {DEMO_ACTIVITIES.map((act) => (
          <div
            key={act.id}
            className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-[#E0F2FE]/30"
          >
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${getBadgeStyle(act.status)}`}>
              {getIcon(act.type)}
            </div>

            <div className="flex-1 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900 truncate">
                  {act.title}
                </span>
                {act.amount !== undefined && (
                  <span className="text-xs font-mono font-bold text-slate-900 shrink-0">
                    ${act.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-2">
                {act.description}
              </p>
              <span className="mt-1 block text-[10px] text-slate-400">
                {new Date(act.timestamp).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BusinessActivityPanel;
