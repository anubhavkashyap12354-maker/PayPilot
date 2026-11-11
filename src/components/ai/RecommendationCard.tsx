"use client";

import React, { useState } from "react";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Info,
  SlidersHorizontal,
  Loader2,
  XCircle,
} from "lucide-react";
import type { BusinessRecommendation } from "@/lib/ai/tools/business-recommendations";
import type { PersistentApprovalRecord } from "@/types";

interface RecommendationCardProps {
  recommendation: BusinessRecommendation;
  index?: number;
}

type SubmitState = "idle" | "submitting" | "submitted" | "error";

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  index,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [sessionApproved, setSessionApproved] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [approvalRecord, setApprovalRecord] = useState<PersistentApprovalRecord | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const getPriorityBadge = (priority: "urgent" | "high" | "medium" | "low") => {
    switch (priority) {
      case "urgent":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-300 px-2.5 py-0.5 text-[11px] font-extrabold text-red-800">
            <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-ping" />
            URGENT
          </span>
        );
      case "high":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200/80 px-2.5 py-0.5 text-[11px] font-bold text-red-700">
            <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
            HIGH PRIORITY
          </span>
        );
      case "medium":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            MEDIUM PRIORITY
          </span>
        );
      case "low":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            LOW PRIORITY
          </span>
        );
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "risk":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "operations":
        return "bg-sky-100 text-sky-800 border-sky-200";
      case "cash_flow":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  /**
   * Submits this recommendation to the persistent approval API.
   * SAFETY: This creates an approval RECORD only.
   * No PayPal API calls, refunds, captures, or external actions are executed.
   */
  const handleSubmitForApproval = async () => {
    if (submitState !== "idle") return;

    setSubmitState("submitting");
    setSubmitError(null);

    try {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendation_type: recommendation.suggestedAction.actionType,
          title: recommendation.title,
          description: recommendation.summary,
          rationale: recommendation.rationale,
          priority: recommendation.priority,
          related_order_id: recommendation.suggestedAction.targetId ?? null,
          proposed_action: recommendation.suggestedAction.details,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      setApprovalRecord(json.approval as PersistentApprovalRecord);
      setSubmitState("submitted");
      setSessionApproved(true);
      setShowNotice(true);

      // Notify sidebar & other components that an approval was created
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("paypilot:approvals-updated"));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit approval request.";
      setSubmitError(message);
      setSubmitState("error");
    }
  };

  return (
    <div
      className={`rounded-xl border transition-all duration-200 bg-white ${
        recommendation.priority === "high"
          ? "border-amber-200/90 shadow-sm hover:border-amber-300"
          : "border-slate-200/90 shadow-sm hover:border-sky-300"
      }`}
    >
      <div className="p-4 sm:p-5">
        {/* Header Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            {typeof index === "number" && (
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-600">
                #{index + 1}
              </span>
            )}
            {getPriorityBadge(recommendation.priority)}
            <span
              className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getCategoryColor(
                recommendation.category
              )}`}
            >
              {recommendation.category.replace("_", " ")}
            </span>
          </div>

          <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50/80 border border-emerald-200/60 rounded-md px-2 py-0.5 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-emerald-600" />
            <span>Impact: {recommendation.impactEstimate}</span>
          </div>
        </div>

        {/* Title */}
        <h4 className="text-sm font-bold text-slate-900 leading-snug">
          {recommendation.title}
        </h4>

        {/* Action description */}
        <div className="mt-2.5 rounded-lg bg-slate-50/90 border border-slate-200/70 p-3">
          <div className="flex items-start gap-2">
            <ArrowRight className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-800 font-medium leading-relaxed">
              <span className="font-semibold text-slate-900">Recommended Action: </span>
              {recommendation.suggestedAction.details}
            </div>
          </div>
        </div>

        {/* Action Controls & Detailed View Toggle */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-800 transition-colors"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>{isExpanded ? "Hide Details & Rationale" : "Review Details & Rationale"}</span>
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          <div className="flex items-center gap-2">
            {submitState === "submitted" && approvalRecord ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Submitted for Dual-Control (Session)</span>
              </span>
            ) : submitState === "submitting" ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 border border-sky-200 px-3 py-1 text-xs font-semibold text-sky-700">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Submitting…</span>
              </span>
            ) : submitState === "error" ? (
              <button
                onClick={handleSubmitForApproval}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
              >
                <XCircle className="h-3.5 w-3.5" />
                <span>Retry Submit</span>
              </button>
            ) : (
              <button
                onClick={handleSubmitForApproval}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors"
              >
                <Clock className="h-3.5 w-3.5" />
                <span>Submit for Approval</span>
              </button>
            )}
          </div>
        </div>

        {/* Error Notice */}
        {submitState === "error" && submitError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50/80 p-3 text-[11px] text-red-800">
            <div className="flex items-start gap-2">
              <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Submission failed: </span>
                {submitError}
              </div>
            </div>
          </div>
        )}

        {/* Governance Notice Banner on Successful Submission */}
        {submitState === "submitted" && approvalRecord && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-[11px] text-amber-800 animate-fadeIn">
            <div className="flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Dual-Control Governance Notice: </span>
                Approval request <code className="font-mono">{approvalRecord.id}</code> has been
                persisted with status <strong>PENDING</strong>. No financial mutation or external
                action has been executed. A human approver must review and authorize this request
                in the{" "}
                <a href="/approvals" className="underline font-semibold hover:text-amber-900">
                  Approvals Portal
                </a>
                .
              </div>
            </div>
          </div>
        )}

        {/* Expanded Detailed View */}
        {isExpanded && (
          <div className="mt-4 pt-3 border-t border-slate-200/80 space-y-3 text-xs animate-fadeIn">
            {/* Supporting Evidence */}
            <div>
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <Info className="h-3.5 w-3.5 text-sky-600" />
                Data Rationale & Supporting Evidence:
              </span>
              <p className="mt-1 text-slate-600 bg-sky-50/40 border border-sky-100 rounded-lg p-2.5 leading-relaxed">
                {recommendation.rationale}
              </p>
            </div>

            {/* Target & Action Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                <span className="font-semibold text-slate-500 uppercase tracking-wider block">
                  Action Type
                </span>
                <span className="font-medium text-slate-800 capitalize">
                  {recommendation.suggestedAction.actionType.replace(/_/g, " ")}
                </span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                <span className="font-semibold text-slate-500 uppercase tracking-wider block">
                  Target Entity
                </span>
                <span className="font-medium text-slate-800">
                  {recommendation.suggestedAction.targetId || "Store Global"}
                </span>
              </div>
            </div>

            {/* Risks / Limitations */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
              <span className="font-semibold text-slate-700 block mb-0.5">
                Risk & Governance Limitation:
              </span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Under PayPilot&apos;s dual-control security model, this recommendation is strictly
                advisory. High-volume disbursements and customer adjustments require human
                verification through the Approvals portal. Submitting this card creates an
                authorization <em>record</em> only — no funds are moved.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecommendationCard;
