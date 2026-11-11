"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  Search,
  Bell,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  X,
  Loader2,
  User,
  LogOut,
  Settings,
  ShieldCheck,
} from "lucide-react";
import type { Order, Transaction } from "@/types";
import { DEMO_ORDERS, DEMO_TRANSACTIONS } from "@/lib/demo-data";

interface TopNavbarProps {
  onToggleSidebar: () => void;
}

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/": {
    title: "Executive Overview",
    subtitle: "Real-time payment telemetry & business health",
  },
  "/ai-copilot": {
    title: "AI Command Centre",
    subtitle: "Conversational payment intelligence & automated analysis",
  },
  "/transactions": {
    title: "Transactions Ledger",
    subtitle: "Comprehensive payment records, settlement tracking & fee breakdowns",
  },
  "/orders": {
    title: "Customer Orders",
    subtitle: "Track order fulfillment status, line items, and tracking numbers",
  },
  "/intelligence": {
    title: "Intelligence & Insights",
    subtitle: "Automated business heuristics, anomaly detection, and cash projections",
  },
  "/approvals": {
    title: "Approval Workflows",
    subtitle: "Disbursement authorizations, high-value refunds, and dispute actions",
  },
  "/reports": {
    title: "Financial Reports",
    subtitle: "Exportable revenue audits, reconciliation summaries, and CSV data",
  },
  "/settings": {
    title: "System Settings",
    subtitle: "Supabase connection, gateway configurations, and demo environment",
  },
};

// ─── Search ───────────────────────────────────────────────────────────────────

interface SearchResult {
  type: "order" | "transaction";
  id: string;
  label: string;
  sublabel: string;
  href: string;
}

function buildSearchIndex(): SearchResult[] {
  const results: SearchResult[] = [];

  for (const order of DEMO_ORDERS) {
    results.push({
      type: "order",
      id: order.id,
      label: `${order.orderNumber} — ${order.customerName}`,
      sublabel: `Order · $${order.totalAmount.toFixed(2)} · ${order.status}`,
      href: `/orders?highlight=${order.id}`,
    });
  }

  for (const txn of DEMO_TRANSACTIONS) {
    results.push({
      type: "transaction",
      id: txn.id,
      label: `${txn.id} — ${txn.customerName}`,
      sublabel: `Transaction · $${txn.amount.toFixed(2)} · ${txn.status}`,
      href: `/transactions?highlight=${txn.id}`,
    });
  }

  return results;
}

const SEARCH_INDEX = buildSearchIndex();

function runSearch(query: string): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return SEARCH_INDEX.filter(
    (r) =>
      r.label.toLowerCase().includes(q) ||
      r.sublabel.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q)
  ).slice(0, 8);
}

function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hits = runSearch(query);
    setResults(hits);
    setOpen(focused && query.trim().length > 0);
    setActiveIdx(-1);
  }, [query, focused]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setQuery("");
      setOpen(false);
      router.push(result.href);
    },
    [router]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(results[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  };

  return (
    <div ref={containerRef} className="relative hidden md:block w-48 lg:w-64">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search orders, TXNs..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
        aria-label="Search orders and transactions"
        aria-autocomplete="list"
        aria-expanded={open}
        className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-1.5 pl-9 pr-7 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none transition-colors"
      />
      {query && (
        <button
          onMouseDown={(e) => { e.preventDefault(); setQuery(""); setOpen(false); }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          aria-label="Clear search"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {open && (
        <div
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1.5 rounded-xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden"
        >
          {results.length > 0 ? (
            <ul className="max-h-72 overflow-y-auto py-1">
              {results.map((r, idx) => (
                <li
                  key={r.id}
                  role="option"
                  aria-selected={idx === activeIdx}
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(r); }}
                  className={`flex flex-col px-3 py-2 cursor-pointer transition-colors ${
                    idx === activeIdx ? "bg-sky-50" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="text-xs font-semibold text-slate-800 truncate">{r.label}</span>
                  <span className={`text-[10px] mt-0.5 ${r.type === "order" ? "text-sky-600" : "text-emerald-600"}`}>
                    {r.sublabel}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-4 text-center text-xs text-slate-400">
              No results for &ldquo;<span className="font-medium text-slate-600">{query}</span>&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Profile Dropdown ─────────────────────────────────────────────────────────

function ProfileDropdown() {
  const [open, setOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<{ email: string; role: string } | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Check session on mount
  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.authenticated && data.user) {
          setSessionUser({ email: data.user.email, role: data.user.role });
        }
      })
      .catch(() => {/* no-op */});
  }, []);

  // Listen for auth changes from ApprovalsView
  useEffect(() => {
    const handleUpdate = () => {
      fetch("/api/auth/session", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.authenticated && data.user) {
            setSessionUser({ email: data.user.email, role: data.user.role });
          } else {
            setSessionUser(null);
          }
        })
        .catch(() => {/* no-op */});
    };
    window.addEventListener("paypilot:approvals-updated", handleUpdate);
    return () => window.removeEventListener("paypilot:approvals-updated", handleUpdate);
  }, []);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      setSessionUser(null);
      setOpen(false);
      window.dispatchEvent(new CustomEvent("paypilot:approvals-updated"));
    } catch {
      /* no-op */
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 pl-1.5 pr-2.5 hover:bg-slate-50 cursor-pointer transition-colors"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-sky-600 to-sky-400 text-white font-bold text-xs shadow-sm">
          AP
        </div>
        <div className="hidden sm:flex flex-col text-left">
          <span className="text-xs font-semibold text-slate-900 leading-tight">
            {sessionUser ? sessionUser.email.split("@")[0] : "Admin User"}
          </span>
          <span className="text-[10px] text-slate-400 leading-tight">
            {sessionUser ? sessionUser.role : "Finance Lead"}
          </span>
        </div>
        <ChevronDown
          className={`hidden sm:block h-3.5 w-3.5 text-slate-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden">
          {/* Account info */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/70">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-sky-400 text-white font-bold text-sm shadow-sm">
              AP
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">
                {sessionUser?.email ?? "admin@paypilot.demo"}
              </p>
              <p className="text-[10px] text-slate-400 capitalize">
                {sessionUser?.role ?? "Finance Lead"} · Demo Environment
              </p>
            </div>
          </div>

          {/* Menu items */}
          <div className="py-1.5">
            <button
              onClick={() => { setOpen(false); router.push("/settings"); }}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Settings className="h-3.5 w-3.5 text-slate-400" />
              System Settings
            </button>
            <button
              onClick={() => { setOpen(false); router.push("/approvals"); }}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
              Approval Workflows
            </button>
          </div>

          {/* Sign out / sign in */}
          <div className="border-t border-slate-100 py-1.5">
            {sessionUser ? (
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
              >
                {signingOut
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <LogOut className="h-3.5 w-3.5" />
                }
                Sign Out
              </button>
            ) : (
              <button
                onClick={() => { setOpen(false); router.push("/approvals"); }}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-xs text-sky-700 hover:bg-sky-50 transition-colors"
              >
                <User className="h-3.5 w-3.5" />
                Sign In (Demo Session)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main TopNavbar ───────────────────────────────────────────────────────────

export const TopNavbar: React.FC<TopNavbarProps> = ({ onToggleSidebar }) => {
  const pathname = usePathname();
  const [showNotifications, setShowNotifications] = useState(false);

  const pageInfo = pageTitles[pathname] || {
    title: "PayPilot Operations",
    subtitle: "Business payment operations copilot",
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 sm:px-6 backdrop-blur-md">
      {/* Left: Mobile Toggle & Page Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="Open sidebar navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              {pageInfo.title}
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
              DEMO ENVIRONMENT
            </span>
          </div>
          <p className="hidden md:block text-xs text-slate-500 truncate max-w-md">
            {pageInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Search, Notifications, Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Search */}
        <SearchBar />

        {/* Small screen demo badge */}
        <span className="sm:hidden rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
          DEMO
        </span>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 transition-colors"
            aria-label="Toggle notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-sky-600 text-[9px] font-bold text-white ring-2 ring-white">
              3
            </span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl z-50">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-semibold text-slate-800">Operational Alerts</span>
                <span className="text-[10px] text-sky-600 font-medium cursor-pointer">Mark all read</span>
              </div>
              <div className="mt-2 space-y-2 text-xs">
                <div className="rounded-lg bg-amber-50 p-2.5 text-slate-700 border border-amber-100">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                    <span>Approval Required</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-600">
                    High-value refund request ($450.00) awaits merchant authorization.
                  </p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-2.5 text-slate-700 border border-emerald-100">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>PayPal Batch Cleared</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-600">
                    $4,850.00 settlement successfully transferred to business checking.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <ProfileDropdown />
      </div>
    </header>
  );
};
export default TopNavbar;
