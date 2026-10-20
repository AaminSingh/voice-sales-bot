"use client";

import React, { useRef, useEffect } from "react";
import { useVoiceCall, CallStatus } from "@/hooks/useVoiceCall";

const statusDisplayLabels: Record<CallStatus, string> = {
  idle: "Idle",
  connecting: "Connecting...",
  listening: "Listening...",
  thinking: "Thinking...",
  speaking: "Bot Speaking...",
  ended: "Call Ended",
  error: "Error",
};

export default function CallPage() {
  const {
    status,
    messages,
    interimText,
    error,
    clearError,
    isSupported,
    language,
    setLanguage,
    headphonesMode,
    setHeadphonesMode,
    voiceWarning,
    startCall,
    endCall,
    interrupt,
  } = useVoiceCall();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isCallActive = status !== "idle" && status !== "ended";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interimText, status]);

  return (
    <div className="flex-1 flex flex-col justify-center py-6 px-4 sm:px-6 lg:px-8 max-w-4xl w-full mx-auto">
      {/* Unsupported Browser Alert Banner */}
      {!isSupported && (
        <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-3 shadow-xs">
          <svg
            className="w-5 h-5 shrink-0 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <span className="font-medium">
            Voice calls need Google Chrome (or Edge) on desktop or Android.
          </span>
        </div>
      )}

      {/* Dismissible Error Banner */}
      {error && (
        <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <svg
              className="w-4 h-4 shrink-0 text-rose-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={clearError}
            className="p-1 text-rose-500 hover:text-rose-800 rounded-lg hover:bg-rose-100 transition-colors"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Non-blocking Hindi Voice Warning */}
      {voiceWarning && (
        <div className="mb-3 px-3.5 py-2 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-700 text-xs flex items-center gap-2">
          <span className="font-semibold">Note:</span>
          <span>{voiceWarning}</span>
        </div>
      )}

      {/* Main Call Container */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
        {/* Header Area */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-4">
          {/* Status Badge & Indicator */}
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              {status === "listening" && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              {status === "speaking" && (
                <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              )}
              {status === "thinking" && (
                <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-3 w-3 ${
                  status === "listening"
                    ? "bg-emerald-500"
                    : status === "speaking"
                    ? "bg-indigo-600"
                    : status === "thinking"
                    ? "bg-amber-500"
                    : status === "connecting"
                    ? "bg-blue-500"
                    : status === "error"
                    ? "bg-rose-500"
                    : "bg-slate-400"
                }`}
              ></span>
            </span>

            <span className="text-sm font-semibold text-slate-700">
              Call Status:{" "}
              <span className="text-slate-900 font-medium">
                {statusDisplayLabels[status]}
              </span>
            </span>

            {/* Tap to Interrupt Button (visible only while bot is speaking) */}
            {status === "speaking" && (
              <button
                type="button"
                onClick={interrupt}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors shadow-2xs animate-pulse"
                title="Interrupt bot speech and speak now"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2.2"
                  stroke="currentColor"
                >
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
                Tap to interrupt
              </button>
            )}
          </div>

          {/* Right Header Controls: Language Selector & Duration */}
          <div className="flex items-center gap-3">
            {/* Language Dropdown (disabled while call is active) */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="callLanguage" className="text-xs font-medium text-slate-500">
                Language:
              </label>
              <select
                id="callLanguage"
                value={language}
                onChange={(e) => setLanguage(e.target.value as "en" | "hi")}
                disabled={isCallActive}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-hidden focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed shadow-2xs"
              >
                <option value="en">English (Indian)</option>
                <option value="hi">Hindi (हिंदी)</option>
              </select>
            </div>

            {/* Duration Placeholder */}
            <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-2xs">
              <svg
                className="w-4 h-4 text-slate-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="text-sm font-mono font-medium text-slate-700">
                Duration: 00:00
              </span>
            </div>
          </div>
        </div>

        {/* Large Chat Panel Area */}
        {messages.length === 0 && !interimText ? (
          <div className="min-h-[380px] p-8 flex flex-col items-center justify-center bg-white text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
              <svg
                className="w-7 h-7"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.8"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.84-.84c.16-.928.6-1.78 1.258-2.474C4.304 16.14 3 14.19 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                />
              </svg>
            </div>
            <p className="text-base font-medium text-slate-600">
              Conversation will appear here
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Press &quot;Start Call&quot; to initiate a voice conversation with the AI sales agent.
            </p>
          </div>
        ) : (
          <div className="min-h-[380px] max-h-[460px] p-6 overflow-y-auto space-y-4 bg-white">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <span className="text-[10px] text-slate-400 font-medium mb-1 px-1">
                  {m.role === "user" ? "You (Customer)" : "Riya (AI Sales Rep)"}
                </span>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-2xs ${
                    m.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-xs"
                      : "bg-slate-100 text-slate-800 border border-slate-200/80 rounded-bl-xs"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {/* Live Partial Speech Bubble (Customer Speaking) */}
            {interimText && (
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-indigo-400 font-medium mb-1 px-1 flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                  Speaking...
                </span>
                <div className="max-w-[85%] rounded-2xl rounded-br-xs px-4 py-2.5 text-sm leading-relaxed bg-indigo-50/70 text-indigo-900 border border-dashed border-indigo-200 shadow-2xs italic">
                  {interimText}
                </div>
              </div>
            )}

            {/* Thinking indicator */}
            {status === "thinking" && (
              <div className="flex flex-col items-start">
                <span className="text-[10px] text-slate-400 font-medium mb-1 px-1">
                  Riya (AI Sales Rep)
                </span>
                <div className="bg-slate-100 border border-slate-200/80 text-slate-500 rounded-2xl rounded-bl-xs px-4 py-2.5 text-sm flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                  Thinking...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Headphones Mode Option Bar */}
        <div className="px-6 py-2.5 border-t border-slate-100 bg-slate-50/40 flex flex-col items-center justify-center text-center">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={headphonesMode}
              onChange={(e) => setHeadphonesMode(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
            />
            <span>Headphones mode (allow voice interruption)</span>
          </label>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Use only with headphones, otherwise the bot may hear itself.
          </p>
        </div>

        {/* Action Buttons Area */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-center gap-4">
          {/* Start Call Button */}
          <button
            type="button"
            onClick={startCall}
            disabled={isCallActive || !isSupported}
            className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition-all shadow-xs ${
              !isCallActive && isSupported
                ? "text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                : "text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed opacity-60"
            }`}
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            Start Call
          </button>

          {/* End Call Button */}
          <button
            type="button"
            onClick={endCall}
            disabled={!isCallActive}
            className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition-all ${
              isCallActive
                ? "text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 cursor-pointer shadow-xs focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
                : "text-rose-300 bg-rose-100/60 border border-rose-200/50 cursor-not-allowed opacity-60"
            }`}
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            End Call
          </button>
        </div>
      </div>
    </div>
  );
}
