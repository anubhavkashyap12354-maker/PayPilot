import React from "react";
import AIChatInterface from "@/components/ai/AIChatInterface";

export default function AICopilotPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            AI Command Centre
          </h1>
          <p className="text-xs text-slate-500">
            Automated payment intelligence, customer trend summarization, and risk mitigation
          </p>
        </div>
      </div>

      <AIChatInterface />
    </div>
  );
}
