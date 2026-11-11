"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  CreditCard,
  Download,
  X,
  Receipt,
  ShieldCheck,
  Calendar,
  Layers,
} from "lucide-react";
import { DEMO_TRANSACTIONS } from "@/lib/demo-data";
import { Transaction, PaymentStatus } from "@/types";

export const TransactionsView: React.FC = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);

  const filteredTransactions = useMemo(() => {
    let list = [...DEMO_TRANSACTIONS];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.customerName.toLowerCase().includes(q) ||
          t.customerEmail.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      list = list.filter((t) => t.status === statusFilter);
    }

    if (methodFilter !== "all") {
      list = list.filter((t) => t.paymentMethod === methodFilter);
    }

    list.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return sortAsc ? timeA - timeB : timeB - timeA;
    });

    return list;
  }, [search, statusFilter, methodFilter, sortAsc]);

  const renderBadge = (status: PaymentStatus) => {
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
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Transactions Ledger
            </h1>
            <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700 border border-sky-100">
              DEMO DATA
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time verified settlement logs with automated dispute status checking
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">
            {filteredTransactions.length} records found
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ID, customer name, email or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
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

          {/* Payment Method filter */}
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white py-1.5 px-3 text-xs font-medium text-slate-700 focus:border-sky-500 focus:outline-none"
          >
            <option value="all">All Channels</option>
            <option value="paypal">PayPal</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="apple_pay">Apple Pay</option>
          </select>

          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span>{sortAsc ? "Oldest" : "Newest"}</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Transaction ID</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Description</th>
                <th className="py-3.5 px-4">Channel</th>
                <th className="py-3.5 px-4 text-right">Fee</th>
                <th className="py-3.5 px-4 text-right">Net Amount</th>
                <th className="py-3.5 px-4 text-right">Gross Amount</th>
                <th className="py-3.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedTxn(t)}
                    className="hover:bg-[#E0F2FE]/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-sky-600 group-hover:underline">
                      {t.id}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{t.customerName}</div>
                      <div className="text-[11px] text-slate-400">{t.customerEmail}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                      {t.description}
                    </td>
                    <td className="py-3.5 px-4 capitalize text-slate-700">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        {t.paymentMethod.replace("_", " ")}
                        {t.cardLast4 ? ` (•••• ${t.cardLast4})` : ""}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                      ${t.fee.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                      ${t.netAmount.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      ${t.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {renderBadge(t.status)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No transactions matched your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Details Modal */}
      {selectedTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setSelectedTxn(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Transaction {selectedTxn.id}
                </h3>
                <span className="text-xs text-slate-400">
                  Logged {new Date(selectedTxn.timestamp).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200/50">
                <span className="text-slate-500">Customer</span>
                <span className="font-semibold text-slate-900">{selectedTxn.customerName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/50">
                <span className="text-slate-500">Customer Email</span>
                <span className="font-medium text-slate-700">{selectedTxn.customerEmail}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/50">
                <span className="text-slate-500">Order Reference</span>
                <span className="font-mono text-sky-600 font-semibold">{selectedTxn.orderId || "N/A"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/50">
                <span className="text-slate-500">Payment Gateway</span>
                <span className="font-medium capitalize text-slate-800">
                  {selectedTxn.paymentMethod.replace("_", " ")}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/50">
                <span className="text-slate-500">Processing Fee</span>
                <span className="font-mono text-slate-700">${selectedTxn.fee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/50">
                <span className="text-slate-500">Net Merchant Payout</span>
                <span className="font-mono font-bold text-slate-900">${selectedTxn.netAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Status</span>
                <span>{renderBadge(selectedTxn.status)}</span>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSelectedTxn(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionsView;
