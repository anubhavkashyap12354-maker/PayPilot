"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Receipt,
  ShoppingBag,
  Sparkles,
  ShieldCheck,
  FileBarChart,
  Settings,
  ChevronRight,
  Layers,
  X,
} from "lucide-react";
import type { PersistentApprovalRecord } from "@/types";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItemConfig {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  isApprovalItem?: boolean;
}

const navItems: NavItemConfig[] = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "AI Command Centre", href: "/ai-copilot", icon: Bot, badge: "Copilot" },
  { name: "Transactions", href: "/transactions", icon: Receipt },
  { name: "Orders", href: "/orders", icon: ShoppingBag },
  { name: "Intelligence", href: "/intelligence", icon: Sparkles },
  { name: "Approvals", href: "/approvals", icon: ShieldCheck, isApprovalItem: true },
  { name: "Reports", href: "/reports", icon: FileBarChart },
  { name: "Settings", href: "/settings", icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const pathname = usePathname();
  const [pendingApprovalCount, setPendingApprovalCount] = useState<number | null>(null);

  const fetchPendingApprovals = useCallback(async () => {
    try {
      const res = await fetch("/api/approvals", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!res.ok) {
        // Unauthenticated (401), Forbidden (403), or server error: hide badge
        setPendingApprovalCount(null);
        return;
      }

      const json = await res.json();
      if (json.success && Array.isArray(json.approvals)) {
        // Exact same definition as ApprovalsView: status === "pending"
        const count = (json.approvals as PersistentApprovalRecord[]).filter(
          (a) => a.status === "pending"
        ).length;
        setPendingApprovalCount(count);
      } else {
        setPendingApprovalCount(null);
      }
    } catch {
      // Network or fetch error: do not display a misleading count
      setPendingApprovalCount(null);
    }
  }, []);

  useEffect(() => {
    // 1. Initial load
    fetchPendingApprovals();

    // 2. Refresh on window focus (user returns to application tab)
    const handleFocus = () => {
      fetchPendingApprovals();
    };

    // 3. Refresh on custom approval update event
    const handleApprovalUpdate = () => {
      fetchPendingApprovals();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("paypilot:approvals-updated", handleApprovalUpdate);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("paypilot:approvals-updated", handleApprovalUpdate);
    };
  }, [fetchPendingApprovals]);

  // Also refresh when pathname changes (e.g. navigating to/from Approvals or AI Copilot)
  useEffect(() => {
    fetchPendingApprovals();
  }, [pathname, fetchPendingApprovals]);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-100">
          <Link href="/" className="flex items-center gap-3 group" onClick={() => onClose()}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 text-white shadow-sm shadow-sky-500/20 transition-transform group-hover:scale-105">
              <Layers className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-slate-900 text-lg">PayPilot</span>
                <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                  v1.0
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-400">Payment Operations Copilot</span>
            </div>
          </Link>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5 px-3 py-4 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Operations Menu
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onClose()}
                className={`group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-sky-50 text-sky-700 shadow-sm border border-sky-100 font-semibold"
                    : "text-slate-600 hover:bg-[#E0F2FE]/60 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-5 w-5 transition-colors ${
                      isActive ? "text-sky-600" : "text-slate-400 group-hover:text-sky-600"
                    }`}
                  />
                  <span>{item.name}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.badge && (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                      {item.badge}
                    </span>
                  )}
                  {item.isApprovalItem && pendingApprovalCount !== null && pendingApprovalCount > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                      {pendingApprovalCount}
                    </span>
                  )}
                  {isActive && <ChevronRight className="h-4 w-4 text-sky-500" />}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Business Context Card Footer */}
        <div className="p-4 border-t border-slate-100">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs">
                AV
              </div>
              <div className="overflow-hidden">
                <div className="truncate text-xs font-semibold text-slate-800">
                  Apex Velocity Tech
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>Demo Merchant (USD)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
export default Sidebar;
