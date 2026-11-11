"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Check,
  X,
  MessageSquare,
  RefreshCw,
  Loader2,
  History,
  ChevronDown,
  ChevronUp,
  LogIn,
  LogOut,
  UserCheck,
} from "lucide-react";
import type {
  PersistentApprovalRecord,
  PersistentApprovalStatus,
  ApprovalAuditEntry,
} from "@/types";

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_FILTERS = ["all", "pending", "approved", "rejected", "changes_requested"] as const;

function StatusBadge({ status }: { status: PersistentApprovalStatus }) {
  switch (status) {
    case "approved":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-100">
          <CheckCircle className="h-3 w-3" />
          Approved
        </span>
      );
    case "rejected":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600 border border-red-100">
          <XCircle className="h-3 w-3" />
          Rejected
        </span>
      );
    case "pending":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-100">
          <Clock className="h-3 w-3" />
          Pending Authorization
        </span>
      );
    case "changes_requested":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700 border border-sky-100">
          <MessageSquare className="h-3 w-3" />
          Changes Requested
        </span>
      );
  }
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    urgent: "bg-red-100 text-red-800 border-red-200",
    high: "bg-orange-50 text-orange-700 border-orange-200",
    medium: "bg-amber-50 text-amber-700 border-amber-100",
    low: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase border ${map[priority] ?? map.low}`}
    >
      {priority}
    </span>
  );
}

// ─── Audit History Panel ──────────────────────────────────────────────────────

function AuditHistoryPanel({ approvalId }: { approvalId: string }) {
  const [entries, setEntries] = useState<ApprovalAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/approvals/${approvalId}?audit=true`)
      .then(async (r) => {
        const json = await r.json();
        if (r.status === 401) {
          throw new Error("Authentication required to view audit trail.");
        }
        if (json.success) {
          setEntries(json.auditHistory ?? []);
        } else {
          setError(json.error || "Failed to load audit history.");
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error loading audit history."))
      .finally(() => setLoading(false));
  }, [approvalId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading audit history…
      </div>
    );
  }
  if (error) {
    return <p className="text-xs text-red-600 py-2">{error}</p>;
  }
  if (entries.length === 0) {
    return <p className="text-xs text-slate-400 py-2">No audit entries yet.</p>;
  }

  return (
    <div className="space-y-1.5 mt-2">
      {entries.map((e) => (
        <div
          key={e.id}
          className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px]"
        >
          <History className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-slate-700">
              {e.previous_status ? `${e.previous_status} → ` : "Created as "}
              <span className="text-sky-700">{e.new_status}</span>
            </span>
            {e.decision_reason && (
              <span className="text-slate-500 ml-1">· &ldquo;{e.decision_reason}&rdquo;</span>
            )}
            <div className="text-slate-400 mt-0.5">
              Verified Actor: <strong className="text-slate-600">{e.actor_id}</strong> · {new Date(e.recorded_at).toLocaleString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Decision Modal ───────────────────────────────────────────────────────────

interface DecisionModalProps {
  approval: PersistentApprovalRecord;
  onClose: () => void;
  onDecision: (id: string, status: "approved" | "rejected" | "changes_requested", reason: string) => Promise<void>;
}

function DecisionModal({ approval, onClose, onDecision }: DecisionModalProps) {
  const [status, setStatus] = useState<"approved" | "rejected" | "changes_requested">("approved");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onDecision(approval.id, status, reason.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record decision.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-base font-bold text-slate-900 mb-1">Record Decision</h3>
        <p className="text-xs text-slate-500 mb-4">
          <strong>{approval.title}</strong>
          <br />
          <span className="text-amber-700 font-medium">
            ⚠ Dual-control authorization only. No PayPal API calls, refunds, captures,
            or external actions are executed.
          </span>
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Decision</label>
            <div className="flex gap-2">
              {(["approved", "rejected", "changes_requested"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold capitalize transition-all ${
                    status === s
                      ? s === "approved"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : s === "rejected"
                        ? "bg-red-600 text-white border-red-600"
                        : "bg-sky-600 text-white border-sky-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                  }`}
                >
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Decision Reason <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Provide reason for audit logging…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-300 resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 rounded-lg bg-sky-600 hover:bg-sky-700 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-1"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Confirm Decision
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main ApprovalsView ───────────────────────────────────────────────────────

export const ApprovalsView: React.FC = () => {
  const [approvals, setApprovals] = useState<PersistentApprovalRecord[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUnauthenticated, setIsUnauthenticated] = useState(false);
  const [sessionUser, setSessionUser] = useState<{ id: string; email: string } | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [decisionTarget, setDecisionTarget] = useState<PersistentApprovalRecord | null>(null);
  const [expandedAudit, setExpandedAudit] = useState<string | null>(null);

  // Check auth session state
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      if (res.ok) {
        const json = await res.json();
        if (json.authenticated && json.user) {
          setSessionUser(json.user);
          setIsUnauthenticated(false);
          return true;
        }
      }
      setSessionUser(null);
      setIsUnauthenticated(true);
      return false;
    } catch {
      setSessionUser(null);
      setIsUnauthenticated(true);
      return false;
    }
  }, []);

  const loadApprovals = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const url = filter !== "all" ? `/api/approvals?status=${filter}` : "/api/approvals";
      const res = await fetch(url);
      const json = await res.json();

      if (res.status === 401) {
        setIsUnauthenticated(true);
        setSessionUser(null);
        setError("Authentication required. Please sign in to view payment approvals.");
        return false;
      }

      if (res.status === 403) {
        setError("Access forbidden. Your account does not possess permission to review approvals.");
        return false;
      }

      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      setApprovals(json.approvals ?? []);
      setIsUnauthenticated(false);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load approvals.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Initial load
  useEffect(() => {
    checkSession().then(() => {
      loadApprovals();
    });
  }, [checkSession, loadApprovals]);

  // Sign in with demo operator session
  const handleSignInDemo = async () => {
    setError(null);
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success || !json.user) {
        setIsUnauthenticated(true);
        setSessionUser(null);
        setError(json.error || "Failed to establish demo session.");
        return;
      }

      // Ensure approvals API request also succeeds before claiming authentication
      const approvalsLoaded = await loadApprovals();
      if (approvalsLoaded) {
        setSessionUser(json.user);
        setIsUnauthenticated(false);
        setNotification(`Authenticated as ${json.user.email}.`);
        setTimeout(() => setNotification(null), 4000);

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("paypilot:approvals-updated"));
        }
      } else {
        // If approvals request failed, ensure we do not falsely display an authenticated state
        setSessionUser(null);
        setIsUnauthenticated(true);
      }
    } catch (err) {
      setIsUnauthenticated(true);
      setSessionUser(null);
      setError(err instanceof Error ? err.message : "Failed to establish session.");
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      setSessionUser(null);
      setIsUnauthenticated(true);
      setApprovals([]);
      setNotification("Session signed out.");
      setTimeout(() => setNotification(null), 3000);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("paypilot:approvals-updated"));
      }
    } catch {
      // Ignore
    }
  };

  const handleDecision = async (
    id: string,
    status: "approved" | "rejected" | "changes_requested",
    reason: string
  ) => {
    const res = await fetch(`/api/approvals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, decision_reason: reason || undefined }),
    });

    if (res.status === 401) {
      setIsUnauthenticated(true);
      throw new Error("Session expired. Please sign in again to record decisions.");
    }

    if (res.status === 409) {
      // Concurrency conflict
      await loadApprovals();
      throw new Error("Concurrency conflict: This approval was modified by another reviewer. The list has been refreshed.");
    }

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }

    // Refresh list from server (no optimistic state)
    await loadApprovals();

    // Broadcast update so Sidebar and other components sync their pending badge
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("paypilot:approvals-updated"));
    }

    setNotification(
      `Decision recorded: ${status.toUpperCase()} for "${json.approval?.title}". ` +
      "No financial or external action was executed."
    );
    setTimeout(() => setNotification(null), 5000);
  };

  const pendingCount = approvals.filter((a) => a.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-sky-600" />
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Payment & Disbursement Approvals
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Dual-control governance for high-value refunds, vendor payouts, and dispute settlements.
            Approval records advisory authorization only — no financial actions are executed.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {sessionUser ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs text-slate-700">
                <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span className="font-medium truncate max-w-[150px]">{sessionUser.email}</span>
              </span>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                title="Sign out session"
              >
                <LogOut className="h-3 w-3" />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignInDemo}
              className="inline-flex items-center gap-1 rounded-xl bg-sky-600 hover:bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Sign In (Demo Session)</span>
            </button>
          )}

          {pendingCount > 0 && (
            <span className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
              {pendingCount} Pending
            </span>
          )}

          <button
            onClick={loadApprovals}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs font-medium text-sky-800 shadow-sm animate-in fade-in">
          {notification}
        </div>
      )}

      {/* Unauthenticated notice */}
      {isUnauthenticated && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 text-xs text-amber-900 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-sm text-amber-950">Authentication Required</h3>
                <p className="mt-1 text-amber-800 leading-relaxed">
                  Under PayPilot Dual-Control Payment Security, viewing approval requests, auditing decision history,
                  and authorizing disbursement proposals requires an authenticated user session.
                </p>
              </div>
            </div>
            <button
              onClick={handleSignInDemo}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Authenticate Session</span>
            </button>
          </div>
        </div>
      )}

      {/* Safety Notice */}
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        <AlertCircle className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
        <p>
          <strong>Governance Model:</strong> Approvals record human authorization decisions only.
          No PayPal API calls, refunds, payment captures, payment retries, email sending, or external
          actions are triggered by any decision.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {STATUS_FILTERS.map((st) => (
          <button
            key={st}
            onClick={() => setFilter(st)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
              filter === st
                ? "bg-white text-sky-700 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {st.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500 text-sm">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading approval records…
        </div>
      ) : error && !isUnauthenticated ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 text-center">
          <XCircle className="h-6 w-6 mx-auto mb-2 text-red-400" />
          <p className="font-semibold">Failed to load approvals</p>
          <p className="text-xs mt-1">{error}</p>
          <button
            onClick={loadApprovals}
            className="mt-3 text-xs font-semibold text-red-700 underline hover:text-red-900"
          >
            Try again
          </button>
        </div>
      ) : approvals.length === 0 && !isUnauthenticated ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          <ShieldCheck className="h-8 w-8 mx-auto mb-3 text-slate-300" />
          <p className="font-semibold text-slate-700">No approval records found</p>
          <p className="text-xs mt-1 text-slate-400">
            {filter !== "all"
              ? `No approvals with status "${filter.replace("_", " ")}"`
              : "Submit a recommendation from the AI Copilot to create approval records."}
          </p>
        </div>
      ) : !isUnauthenticated ? (
        <div className="space-y-4">
          {approvals.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2 flex-1 min-w-0">
                  {/* Title row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-sky-600 truncate max-w-[180px]">
                      {item.id}
                    </span>
                    <StatusBadge status={item.status} />
                    <PriorityBadge priority={item.priority} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                  <p className="text-xs text-slate-600 max-w-2xl">{item.description}</p>
                  <p className="text-[11px] text-slate-500 max-w-2xl italic">{item.rationale}</p>

                  {/* Metadata row */}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
                    <span>
                      Type:{" "}
                      <strong className="text-slate-600">
                        {item.recommendation_type.replace(/_/g, " ")}
                      </strong>
                    </span>
                    {item.related_order_id && (
                      <span>
                        Order:{" "}
                        <strong className="text-slate-600">{item.related_order_id}</strong>
                      </span>
                    )}
                    <span>Created: {new Date(item.created_at).toLocaleString()}</span>
                    {item.decided_at && (
                      <span>
                        Decided:{" "}
                        <strong className="text-slate-600">
                          {new Date(item.decided_at).toLocaleString()}
                        </strong>
                      </span>
                    )}
                  </div>

                  {/* Decision reason */}
                  {item.decision_reason && (
                    <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      <strong>Decision reason:</strong> {item.decision_reason}
                    </div>
                  )}

                  {/* Proposed action (advisory) */}
                  <div className="text-[11px] text-sky-700 bg-sky-50/60 border border-sky-100 rounded-lg px-3 py-2">
                    <strong>Proposed advisory action:</strong> {item.proposed_action}
                    <span className="ml-1 text-sky-400 italic">(advisory only — not executed)</span>
                  </div>
                </div>

                {/* Actions column */}
                <div className="flex flex-row md:flex-col items-center md:items-end gap-2 shrink-0">
                  {item.status === "pending" || item.status === "changes_requested" ? (
                    <button
                      onClick={() => setDecisionTarget(item)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Record Decision</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium capitalize">
                      {item.status} · terminal
                    </span>
                  )}

                  {/* Audit history toggle */}
                  <button
                    onClick={() =>
                      setExpandedAudit(expandedAudit === item.id ? null : item.id)
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-sky-700 transition-colors"
                  >
                    <History className="h-3.5 w-3.5" />
                    <span>Audit</span>
                    {expandedAudit === item.id ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expandable audit history */}
              {expandedAudit === item.id && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Audit History
                  </p>
                  <AuditHistoryPanel approvalId={item.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {/* Decision Modal */}
      {decisionTarget && (
        <DecisionModal
          approval={decisionTarget}
          onClose={() => setDecisionTarget(null)}
          onDecision={handleDecision}
        />
      )}
    </div>
  );
};

export default ApprovalsView;
