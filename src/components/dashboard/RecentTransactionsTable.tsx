"use client";

import React, { useState, useMemo } from "react";
import { Search, ArrowUpDown, Filter, CheckCircle2, Clock, XCircle, ExternalLink } from "lucide-react";
import { DEMO_TRANSACTIONS } from "@/lib/demo-data";
import { Transaction, PaymentStatus } from "@/types";
import Link from "next/link";

interface RecentTransactionsTableProps {
  limit?: number;
  showViewAll?: boolean;
}

export const RecentTransactionsTable: React.FC<RecentTransactionsTableProps> = ({
  limit = 5,
  showViewAll = true,
}) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortAsc, setSortAsc] = useState(false);

  const filteredTransactions = useMemo(() => {
    let result = [...DEMO_TRANSACTIONS];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.customerName.toLowerCase().includes(q) ||
          t.customerEmail.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter);
    }

    result.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return sortAsc ? dateA - dateB : dateB - dateA;
    });

    if (limit) {
      return result.slice(0, limit);
    }

    return result;
  }, [search, statusFilter, sortAsc, limit]);

  const renderStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-[#10B981] border border-emerald-100">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-[#F59E0B] border border-amber-100">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600 border border-red-100">
            <XCircle className="h-3 w-3" />
            Failed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-base font-bold text-slate-900">Recent Transactions</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified records from demo settlement batches
          </p>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by customer, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 focus:border-sky-500 focus:bg-white focus:outline-none transition-colors"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {["all", "completed", "pending", "failed"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold capitalize transition-all ${
                  statusFilter === st
                    ? "bg-white text-sky-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            title="Toggle sort date"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{sortAsc ? "Oldest" : "Newest"}</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="py-3 px-4">Transaction ID</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Date & Time</th>
              <th className="py-3 px-4">Payment Method</th>
              <th className="py-3 px-4 text-right">Amount</th>
              <th className="py-3 px-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map((t) => (
                <tr
                  key={t.id}
                  className="hover:bg-[#E0F2FE]/40 transition-colors group"
                >
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                    <span className="text-sky-600 group-hover:underline cursor-pointer">
                      {t.id}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900">{t.customerName}</div>
                    <div className="text-[11px] text-slate-400">{t.customerEmail}</div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                    {new Date(t.timestamp).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    <span className="ml-1 text-[10px] text-slate-400">
                      {new Date(t.timestamp).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 capitalize text-slate-700">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      {t.paymentMethod.replace("_", " ")}
                      {t.cardLast4 ? ` (•••• ${t.cardLast4})` : ""}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                    ${t.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {renderStatusBadge(t.status)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No transactions match the selected filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showViewAll && (
        <div className="mt-4 flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="text-xs text-slate-400">
            Showing {filteredTransactions.length} of {DEMO_TRANSACTIONS.length} demo records
          </span>
          <Link
            href="/transactions"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0284C7] hover:underline"
          >
            <span>View All Transactions</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
};

export default RecentTransactionsTable;
