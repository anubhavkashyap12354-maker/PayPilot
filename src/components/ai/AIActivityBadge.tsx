"use client";

import React from "react";
import {
  Sparkles,
  Bot,
  Terminal,
  CheckCircle2,
  Cpu,
  ShieldCheck,
  Activity,
  Layers,
} from "lucide-react";
import type { ToolExecutionRecord } from "@/lib/ai/types";

interface AIActivityBadgeProps {
  isLiveGemini?: boolean;
  engineName?: string;
  isGenerating?: boolean;
  activeStage?: "idle" | "thinking" | "executing_tools" | "synthesizing" | "complete";
  toolCalls?: ToolExecutionRecord[];
  activeToolName?: string;
}

export const AIActivityBadge: React.FC<AIActivityBadgeProps> = ({
  isLiveGemini = false,
  engineName,
  isGenerating = false,
  activeStage = "idle",
  toolCalls = [],
  activeToolName,
}) => {
  // 1. Dynamic Engine Badge (Header display)
  const renderEngineBadge = () => {
    if (isGenerating) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 border border-sky-300/80 px-2.5 py-0.5 text-[10px] font-bold text-sky-800 shadow-sm animate-pulse">
          <Activity className="h-3 w-3 text-sky-600 animate-spin" />
          <span>Gemini Thinking...</span>
        </span>
      );
    }

    if (isLiveGemini) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/90 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <Cpu className="h-3 w-3 text-emerald-600" />
          <span>{engineName || "Google Gemini Live"}</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800 shadow-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        <Terminal className="h-3 w-3 text-amber-600" />
        <span>{engineName || "Deterministic Tool Engine"}</span>
      </span>
    );
  };

  return <>{renderEngineBadge()}</>;
};

/**
 * Activity indicator rendered in chat stream while generating
 */
export const AILoadingActivityIndicator: React.FC<{
  stage?: "thinking" | "executing_tools" | "synthesizing";
  currentTool?: string;
}> = ({ stage = "thinking", currentTool }) => {
  return (
    <div className="rounded-xl border border-sky-200/80 bg-gradient-to-r from-sky-50/60 to-white p-3.5 shadow-sm max-w-md animate-fadeIn">
      <div className="flex items-center gap-3">
        <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm shadow-sky-600/20">
          <Bot className="h-4 w-4 animate-pulse" />
        </div>

        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-sky-600" />
              {stage === "thinking" && "Gemini 3.6 Flash analyzing query..."}
              {stage === "executing_tools" && "Executing authoritative BI tools..."}
              {stage === "synthesizing" && "Synthesizing operations intelligence..."}
            </span>
            <span className="text-[10px] font-semibold text-sky-700 bg-sky-100 px-1.5 py-0.2 rounded">
              Active Turn
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-ping" />
            <span>
              {currentTool
                ? `Running tool: ${currentTool}`
                : "Scanning verified server store records & payment ledger"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Telemetry summary pill list rendered above structured message responses
 */
export const AIToolExecutionPills: React.FC<{
  toolCalls?: ToolExecutionRecord[];
  isLiveGemini?: boolean;
  engineName?: string;
}> = ({ toolCalls = [], isLiveGemini = false, engineName }) => {
  if (toolCalls.length === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">
        <Layers className="h-3 w-3 text-slate-400" />
        Verified Tools:
      </span>

      {toolCalls.map((tc, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow-xs hover:border-sky-300 transition-colors"
          title={tc.resultSummary || `Executed ${tc.toolName}`}
        >
          <Terminal className="h-2.5 w-2.5 text-sky-600" />
          <span>{tc.toolName}</span>
        </span>
      ))}

      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50/80 border border-emerald-200/60 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
        <ShieldCheck className="h-2.5 w-2.5 text-emerald-600" />
        <span>Grounded in Store Data</span>
      </span>
    </div>
  );
};

export default AIActivityBadge;
