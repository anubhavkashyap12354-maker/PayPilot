"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Bot,
  User,
  Sparkles,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  Terminal,
} from "lucide-react";
import type { AIChatMessage } from "@/lib/ai/types";
import {
  AIActivityBadge,
  AILoadingActivityIndicator,
  AIToolExecutionPills,
} from "./AIActivityBadge";
import StructuredResponseView from "./StructuredResponseView";

const SUGGESTED_PROMPTS = [
  "Analyse today's business activity.",
  "Find transactions that need attention.",
  "Summarise this week's revenue.",
  "Identify unusual payment patterns.",
  "Generate a business performance report.",
];

const INITIAL_MESSAGES: AIChatMessage[] = [
  {
    id: "init_01",
    sender: "assistant",
    text: "Hello! I am **PayPilot Copilot**, your payment operations intelligence assistant. I monitor your PayPal checkout flows, order fulfillments, and financial risk.\n\nHow can I assist your business operations today?",
    timestamp: new Date().toISOString(),
    suggestions: [
      "Analyse today's business activity.",
      "Find transactions that need attention.",
    ],
    isDemoSample: false,
  },
];

export const AIChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<AIChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<
    "thinking" | "executing_tools" | "synthesizing"
  >("thinking");
  const [isLiveGemini, setIsLiveGemini] = useState<boolean>(true);
  const [engineName, setEngineName] = useState<string>("Checking engine...");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, loadingStage]);

  // Initial engine discovery on mount (GET /api/ai/chat)
  useEffect(() => {
    let isMounted = true;
    fetch("/api/ai/chat")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && isMounted) {
          setIsLiveGemini(Boolean(data.isLiveGemini));
          setEngineName(data.engine || "Google Gemini Intelligence");
        }
      })
      .catch(() => {
        if (isMounted) {
          setEngineName("Authoritative BI Engine");
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || isLoading) return;

    const userMsg: AIChatMessage = {
      id: `user_${Date.now()}`,
      sender: "user",
      text: query.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setLoadingStage("thinking");

    // Dynamic stage progression for authentic feedback
    const stageTimer1 = setTimeout(() => {
      setLoadingStage("executing_tools");
    }, 1200);

    const stageTimer2 = setTimeout(() => {
      setLoadingStage("synthesizing");
    }, 2800);

    try {
      // Build conversation history for context (up to 10 recent messages)
      const history = messages
        .filter((m) => m.sender === "user" || m.sender === "assistant")
        .slice(-10)
        .map((m) => ({
          role: m.sender as "user" | "assistant",
          content: m.text,
        }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query.trim(), history }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to process AI response");
      }

      if (typeof data.isLiveGemini === "boolean") {
        setIsLiveGemini(data.isLiveGemini);
      }
      if (data.engine) {
        setEngineName(data.engine);
      }

      setMessages((prev) => [...prev, data.message]);
    } catch (err) {
      console.error("AI Command Centre request error:", err);
      const errorMsg: AIChatMessage = {
        id: `err_${Date.now()}`,
        sender: "assistant",
        text: `### Request Processing Notice\n\n${
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while communicating with the server."
        }\n\nPlease check your server telemetry or retry with one of the quick prompts below.`,
        timestamp: new Date().toISOString(),
        suggestions: [
          "Analyse today's business activity.",
          "Find transactions that need attention.",
          "Summarise this week's revenue.",
        ],
        isDemoSample: false,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const resetChat = () => {
    setMessages(INITIAL_MESSAGES);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
      {/* Header with Dynamic Engine Badge (Task 2) */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-6 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm shadow-sky-600/30">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                PayPilot Business Copilot
              </h2>
              <AIActivityBadge
                isLiveGemini={isLiveGemini}
                engineName={engineName}
                isGenerating={isLoading}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Dual-control payment intelligence grounded in authoritative store records
            </p>
          </div>
        </div>

        <button
          onClick={resetChat}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          title="Reset conversation"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Reset Session</span>
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.sender === "user";

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${
                isUser ? "flex-row-reverse" : "flex-row"
              }`}
            >
              {/* Avatar */}
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                  isUser
                    ? "bg-slate-900 text-white"
                    : "bg-sky-600 text-white shadow-sm shadow-sky-600/20"
                }`}
              >
                {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>

              {/* Message Bubble */}
              <div className="max-w-[88%] sm:max-w-[80%] space-y-1.5">
                <div
                  className={`rounded-2xl p-4 sm:p-5 text-xs leading-relaxed ${
                    isUser
                      ? "bg-sky-600 text-white font-medium rounded-tr-none shadow-sm"
                      : "border border-slate-200/90 bg-slate-50/70 text-slate-800 rounded-tl-none shadow-sm"
                  }`}
                >
                  {/* Verified Tool Execution Pills (Task 2) */}
                  {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && (
                    <AIToolExecutionPills
                      toolCalls={msg.toolCalls}
                      isLiveGemini={isLiveGemini}
                      engineName={engineName}
                    />
                  )}

                  {/* Markdown text body */}
                  <div className="whitespace-pre-wrap font-sans text-xs sm:text-[13px] leading-relaxed">
                    {msg.text}
                  </div>

                  {/* Task 1: Structured AI Responses View (KPIs, Forecast, Anomalies, Recommendations) */}
                  {!isUser && msg.structuredData && (
                    <StructuredResponseView
                      data={msg.structuredData}
                      sourceEngine={engineName}
                    />
                  )}
                </div>

                {/* Prompt suggestions under assistant messages */}
                {!isUser && msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {msg.suggestions.map((sug, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(sug)}
                        className="rounded-full border border-sky-200 bg-sky-50/70 px-2.5 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100 hover:border-sky-300 transition-colors"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}

                <div
                  className={`text-[10px] text-slate-400 ${
                    isUser ? "text-right" : "text-left"
                  }`}
                >
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {/* Dynamic Activity Indicator during Loading (Task 2) */}
        {isLoading && (
          <div className="flex items-start gap-3">
            <AILoadingActivityIndicator stage={loadingStage} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts Bar */}
      <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-2.5 overflow-x-auto">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-sky-500" />
            Quick Prompts:
          </span>
          <div className="flex gap-1.5">
            {SUGGESTED_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(prompt)}
                disabled={isLoading}
                className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-sky-300 hover:bg-[#E0F2FE]/50 hover:text-sky-800 transition-colors disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Input Form */}
      <div className="p-4 border-t border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Ask about revenue trends, order statuses, forecast, or anomalies..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-4 pr-10 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none transition-colors"
            />
          </div>

          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0284C7] text-white shadow-sm hover:bg-[#0369A1] disabled:opacity-40 transition-colors"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChatInterface;
