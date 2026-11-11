"use client";

import React, { useState, useEffect } from "react";
import {
  Database,
  ShieldCheck,
  Bot,
  CreditCard,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Server,
  Layers,
  Settings as SettingsIcon,
  ExternalLink,
  Code2,
  Lock,
  Cpu,
} from "lucide-react";
import { checkSupabaseConnection } from "@/lib/supabase/client";
import { SupabaseConfigStatus, PayPalConfigStatus } from "@/types";

interface AIChatStatus {
  status: string;
  isLiveGemini: boolean;
  engine: string;
  toolsAvailable: string[];
}

export default function SettingsPage() {
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseConfigStatus | null>(null);
  const [paypalStatus, setPaypalStatus] = useState<PayPalConfigStatus | null>(null);
  const [aiStatus, setAiStatus] = useState<AIChatStatus | null>(null);
  const [checkingSupabase, setCheckingSupabase] = useState(true);
  const [checkingPayPal, setCheckingPayPal] = useState(true);
  const [checkingAI, setCheckingAI] = useState(true);

  const checkSupabase = async () => {
    setCheckingSupabase(true);
    try {
      const status = await checkSupabaseConnection();
      setSupabaseStatus(status);
    } catch {
      setSupabaseStatus({
        state: "connection_error",
        message: "Failed to evaluate connection.",
      });
    } finally {
      setCheckingSupabase(false);
    }
  };

  const checkPayPal = async () => {
    setCheckingPayPal(true);
    try {
      const res = await fetch("/api/paypal/status");
      const status = await res.json();
      setPaypalStatus(status);
    } catch (err) {
      setPaypalStatus({
        state: "connection_failed",
        environment: "sandbox",
        clientIdConfigured: false,
        clientSecretConfigured: false,
        message: "Failed to evaluate PayPal connection status.",
        details: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setCheckingPayPal(false);
    }
  };

  const checkAI = async () => {
    setCheckingAI(true);
    try {
      const res = await fetch("/api/ai/chat", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setAiStatus(data);
      } else {
        setAiStatus(null);
      }
    } catch {
      setAiStatus(null);
    } finally {
      setCheckingAI(false);
    }
  };

  const performAllChecks = () => {
    checkSupabase();
    checkPayPal();
    checkAI();
  };

  useEffect(() => {
    performAllChecks();
  }, []);

  const renderSupabaseBadge = () => {
    if (checkingSupabase) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Probing...
        </span>
      );
    }

    if (!supabaseStatus) return null;

    switch (supabaseStatus.state) {
      case "connected":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-[#10B981] border border-emerald-100">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Connected
          </span>
        );
      case "missing_env":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-[#F59E0B] border border-amber-100">
            <AlertTriangle className="h-3.5 w-3.5" />
            Missing Environment Variables (Local Mode)
          </span>
        );
      case "connection_error":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600 border border-red-100">
            <XCircle className="h-3.5 w-3.5" />
            Connection Error
          </span>
        );
    }
  };

  const renderPayPalBadge = () => {
    if (checkingPayPal) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Probing...
        </span>
      );
    }

    if (!paypalStatus) return null;

    switch (paypalStatus.state) {
      case "connection_successful":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-[#10B981] border border-emerald-100">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Connection Successful (OAuth Valid)
          </span>
        );
      case "configured":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-[#0284C7] border border-sky-100">
            <CreditCard className="h-3.5 w-3.5" />
            Sandbox Configured
          </span>
        );
      case "connection_failed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600 border border-red-100">
            <XCircle className="h-3.5 w-3.5" />
            Connection Failed
          </span>
        );
      case "not_configured":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-[#F59E0B] border border-amber-100">
            <AlertTriangle className="h-3.5 w-3.5" />
            Sandbox Not Configured (Simulated Fallback)
          </span>
        );
    }
  };

  const renderAIBadge = () => {
    if (checkingAI) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Probing...
        </span>
      );
    }

    if (!aiStatus) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600 border border-red-100">
          <XCircle className="h-3.5 w-3.5" />
          Engine Offline
        </span>
      );
    }

    if (aiStatus.isLiveGemini) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-[#10B981] border border-emerald-100">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Live Gemini Active
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700 border border-sky-100">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Deterministic Engine Active (Local)
      </span>
    );
  };

  const REPO_MIGRATIONS = [
    { name: "001_initial_schema.sql", desc: "Core Schema, Tables & Read-Only RLS" },
    { name: "002_paypal_sandbox_integration.sql", desc: "PayPal Capture & State Columns" },
    { name: "003_paypal_webhooks.sql", desc: "Webhook Events Ledger & Anon Lockdown" },
    { name: "004_paypal_webhooks_security.sql", desc: "Security Invoker View & Atomic Claims" },
    { name: "005_persistent_approvals.sql", desc: "Multi-Tenant Approvals & Atomic RPC" },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              System Settings &amp; Integrations
            </h1>
            <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700 border border-sky-100">
              PHASE 3D ARCHITECTURE
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Audit backend database linkages, PayPal Sandbox REST API v2 connectivity, Gemini AI Copilot engine, and demo environment health
          </p>
        </div>

        <button
          onClick={performAllChecks}
          disabled={checkingSupabase || checkingPayPal || checkingAI}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${
              checkingSupabase || checkingPayPal || checkingAI ? "animate-spin" : ""
            }`}
          />
          <span>Test All Connections</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. PayPal Checkout Gateway Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  PayPal REST API (Orders v2 Sandbox)
                </h2>
                <span className="text-[11px] text-slate-400">api-m.sandbox.paypal.com</span>
              </div>
            </div>
            {renderPayPalBadge()}
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Status Message:</span>
              <span className="font-medium text-slate-800 text-right">
                {paypalStatus?.message || "Probing configuration..."}
              </span>
            </div>
            {paypalStatus?.details && (
              <div className="flex justify-between text-slate-500 pt-1 border-t border-slate-200/50">
                <span>Details:</span>
                <span className="font-mono text-slate-700 text-right">{paypalStatus.details}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 border-t border-slate-200/50">
              <span className="text-slate-500">Client ID State:</span>
              <span className="font-semibold text-slate-800">
                {paypalStatus?.clientIdConfigured ? "Configured (Masked)" : "Not Configured"}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200/50">
              <span className="text-slate-500">Client Secret State:</span>
              <span className="font-semibold text-slate-800">
                {paypalStatus?.clientSecretConfigured ? "Configured (Protected)" : "Not Configured"}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200/50">
              <span className="text-slate-500">Idempotency &amp; Capture:</span>
              <span className="font-semibold text-emerald-700">
                PayPal-Request-Id + Intent CAPTURE Active
              </span>
            </div>
          </div>

          <div className="mt-3 text-[11px] text-slate-500 leading-relaxed space-y-1.5">
            <p>
              To connect your real PayPal Developer Sandbox account, visit{" "}
              <a
                href="https://developer.paypal.com/dashboard/applications/sandbox"
                target="_blank"
                rel="noreferrer"
                className="text-sky-600 font-semibold hover:underline inline-flex items-center gap-0.5"
              >
                PayPal Developer Dashboard <ExternalLink className="h-3 w-3" />
              </a>{" "}
              and configure:
            </p>
            <div className="rounded-lg bg-slate-100 p-2 font-mono text-[10px] text-slate-700">
              PAYPAL_ENVIRONMENT=sandbox<br />
              PAYPAL_CLIENT_ID=&lt;your-sandbox-client-id&gt;<br />
              PAYPAL_CLIENT_SECRET=&lt;your-sandbox-client-secret&gt;<br />
              PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
            </div>
            <p className="text-[10px] text-slate-400">
              Secrets are stored server-side only and never transmitted to the browser.
            </p>
          </div>
        </div>

        {/* 2. Supabase PostgreSQL Connection & Migrations Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Supabase PostgreSQL Database
                </h2>
                <span className="text-[11px] text-slate-400">@supabase/supabase-js (v2)</span>
              </div>
            </div>
            {renderSupabaseBadge()}
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Status Message:</span>
              <span className="font-medium text-slate-800 text-right">
                {supabaseStatus?.message || "Probing configuration..."}
              </span>
            </div>
            {supabaseStatus?.details && (
              <div className="flex justify-between text-slate-500 pt-1 border-t border-slate-200/50">
                <span>Details:</span>
                <span className="font-mono text-slate-700 text-right">{supabaseStatus.details}</span>
              </div>
            )}
            <div className="pt-1 border-t border-slate-200/50">
              <div className="flex justify-between mb-1.5">
                <span className="text-slate-500 font-medium">Repository Migrations Catalog:</span>
                <span className="font-semibold text-slate-800">5 SQL Migrations Implemented</span>
              </div>
              <ul className="space-y-1 font-mono text-[10px] text-slate-700 bg-white/70 p-2 rounded-lg border border-slate-200/60">
                {REPO_MIGRATIONS.map((m) => (
                  <li key={m.name} className="flex justify-between gap-2">
                    <span className="font-bold text-slate-900 truncate">{m.name}</span>
                    <span className="text-slate-400 font-sans text-[10px] shrink-0">{m.desc}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>Remote Deployment State:</span>
                <span className="font-medium text-slate-600">
                  {supabaseStatus?.state === "connected"
                    ? "Verified remote project connected"
                    : "Operating in verified in-memory fallback store"}
                </span>
              </div>
            </div>

            <div className="pt-1 border-t border-slate-200/50 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Row Level Security (RLS):</span>
                <span className="font-semibold text-emerald-700">Multi-Tenant Isolation Active</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-normal">
                • <strong>Public Access:</strong> Direct write revoked on all tables. Anon read restricted.<br />
                • <strong>Tenant Isolation:</strong> Authenticated reads enforce <code className="text-slate-700">business_id = auth.jwt()</code>.<br />
                • <strong>Webhook Protection:</strong> Raw table locked; public view uses <code className="text-slate-700">security_invoker = true</code>.<br />
                • <strong>Service-Role Operations:</strong> Approval decisions run atomic single-transaction RPC <code className="text-slate-700">decide_approval_atomic</code>.
              </p>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
            The application operates on an in-memory transactional store with identical atomicity and rollback guarantees when environment variables are unconfigured. To link a live Supabase project, define <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-800">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-800">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> in <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-800">.env.local</code>.
          </p>
        </div>

        {/* 3. Demo Sandbox Environment Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                <Server className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Demo Environment State
                </h2>
                <span className="text-[11px] text-slate-400">Phase 3D Active · Sandbox Testbed</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700 border border-sky-100">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Active Sandbox
            </span>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Security Mode:</span>
              <span className="font-semibold text-emerald-700">Strict Fictional Records Only</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Merchant Account:</span>
              <span className="font-medium text-slate-800">Apex Velocity Technologies Ltd</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Ledger Currency:</span>
              <span className="font-mono font-bold text-slate-900">USD ($)</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200/50">
              <span className="text-slate-500">Multi-Tenant Tenant ID:</span>
              <span className="font-mono text-slate-800">biz_paypilot_demo_01</span>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
            All data records, payments, and customers displayed in the UI are synthetic. No real financial credentials or payment cards are stored or charged.
          </p>
        </div>

        {/* 4. AI Copilot Integration Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  AI Integration &amp; Copilot Engine
                </h2>
                <span className="text-[11px] text-slate-400">Google Gemini &amp; Tool Orchestrator</span>
              </div>
            </div>
            {renderAIBadge()}
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Engine Operational Status:</span>
              <span className="font-medium text-slate-800">
                {checkingAI
                  ? "Evaluating..."
                  : aiStatus
                  ? "Operational (Ready)"
                  : "Unavailable (Offline)"}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200/50">
              <span className="text-slate-500">Active Intelligence Engine:</span>
              <span className="font-semibold text-slate-800 font-mono text-[11px]">
                {aiStatus?.engine || "Deterministic Tool Engine (Default)"}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200/50">
              <span className="text-slate-500">Function Calling Protocol:</span>
              <span className="font-semibold text-purple-700">
                Gemini Function Calling (REST v1beta)
              </span>
            </div>
            <div className="pt-1 border-t border-slate-200/50">
              <span className="text-slate-500 block mb-1">Available Business Analytics Tools (5):</span>
              <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                {(aiStatus?.toolsAvailable && aiStatus.toolsAvailable.length > 0
                  ? aiStatus.toolsAvailable
                  : [
                      "get_revenue_analytics",
                      "detect_overdue_orders",
                      "detect_anomalies",
                      "forecast_cash_flow",
                      "get_business_recommendations",
                    ]
                ).map((tool) => (
                  <span
                    key={tool}
                    className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 border border-slate-200/60"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200/50">
              <span className="text-slate-500">Guardrails &amp; Safety:</span>
              <span className="font-semibold text-emerald-700">
                Rate Limited (30 req/min) + Dual-Control Guard
              </span>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
            AI chat prompts are processed through server-side function calling with Gemini. When a live API key is unconfigured, requests seamlessly fall back to the deterministic tool engine without leaking credentials.
          </p>
        </div>
      </div>
    </div>
  );
}
