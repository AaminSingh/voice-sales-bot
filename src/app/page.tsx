"use client";

import React, { useRef, useState, useEffect } from "react";
import { useVoiceCall, formatDuration, CallStatus } from "@/hooks/useVoiceCall";
import CallIndicator from "@/components/CallIndicator";

interface StatusDisplay {
  mainLabel: string;
  subLabel?: string;
  dotColor: string;
  pulse: boolean;
}

function getStatusDisplay(status: CallStatus): StatusDisplay {
  switch (status) {
    case "connecting":
      return { mainLabel: "Connecting", dotColor: "bg-amber-500", pulse: true };
    case "listening":
      return { mainLabel: "Live", subLabel: "Listening", dotColor: "bg-emerald-500", pulse: true };
    case "thinking":
      return { mainLabel: "Live", subLabel: "Thinking", dotColor: "bg-emerald-500", pulse: true };
    case "speaking":
      return { mainLabel: "Live", subLabel: "Bot Speaking", dotColor: "bg-emerald-500", pulse: true };
    case "ended":
    case "error":
      return { mainLabel: "Ended", dotColor: "bg-slate-400", pulse: false };
    case "idle":
    default:
      return { mainLabel: "Idle", dotColor: "bg-slate-400", pulse: false };
  }
}

export default function CallPage() {
  const {
    status,
    messages,
    interimText,
    durationSeconds,
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

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);

  const isCallActive = status !== "idle" && status !== "ended" && status !== "error";
  const statusDisplay = getStatusDisplay(status);

  // Monitor user scroll position to avoid force-scrolling if they are reading history
  const handleScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsUserScrolledUp(distanceFromBottom > 75);
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const el = chatContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior });
    }
  };

  useEffect(() => {
    if (!isUserScrolledUp) {
      scrollToBottom("smooth");
    }
  }, [messages, interimText, status, isUserScrolledUp]);

  return (
    <div className="flex-1 flex flex-col justify-center py-4 sm:py-6 px-3 sm:px-6 lg:px-8 max-w-4xl w-full mx-auto">
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
        <div className="mb-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between shadow-xs">
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
            <span className="font-medium text-xs sm:text-sm">{error}</span>
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

      {/* Non-blocking Device Voice Warning */}
      {voiceWarning && (
        <div className="mb-3 px-3.5 py-2 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-700 text-xs flex items-center gap-2">
          <span className="font-semibold">Note:</span>
          <span>{voiceWarning}</span>
        </div>
      )}

      {/* Main Card Container */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
        {/* Header Area */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status Badge with Accessibility */}
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              {statusDisplay.pulse && (
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    status === "connecting" ? "bg-amber-400" : "bg-emerald-400"
                  }`}
                ></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-3 w-3 ${statusDisplay.dotColor}`}
              ></span>
            </span>

            <div
              aria-live="polite"
              className="flex items-center gap-2 text-sm font-semibold text-slate-700"
            >
              <span>Call Status:</span>
              <span className="text-slate-900 font-bold">
                {statusDisplay.mainLabel}
              </span>
              {statusDisplay.subLabel && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100/80 text-emerald-800 border border-emerald-200/60">
                  {statusDisplay.subLabel}
                </span>
              )}
            </div>

            {/* Tap to Interrupt Button (visible only while bot is speaking) */}
            {status === "speaking" && (
              <button
                type="button"
                onClick={interrupt}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors shadow-2xs animate-pulse"
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

          {/* Right Header Controls: Language Selector & Monospace Duration Pill */}
          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
            {/* Language Selector Dropdown */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="callLanguage" className="text-xs font-medium text-slate-500">
                Language:
              </label>
              <select
                id="callLanguage"
                value={language}
                onChange={(e) => setLanguage(e.target.value as "en" | "hi")}
                disabled={isCallActive}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-hidden focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
              >
                <option value="en">English (Indian)</option>
                <option value="hi">Hindi (हिंदी)</option>
              </select>
            </div>

            {/* Monospace Duration Pill */}
            <div className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-2xs">
              <svg
                className="w-3.5 h-3.5 text-slate-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="text-xs font-mono font-bold text-slate-700">
                Duration: {formatDuration(durationSeconds)}
              </span>
            </div>
          </div>
        </div>

        {/* Listening / Speaking Animated Indicator */}
        <CallIndicator status={status} />

        {/* Fixed-Height Scrollable Chat Panel (scrolls inside itself) */}
        <div className="relative">
          <div
            ref={chatContainerRef}
            onScroll={handleScroll}
            className="h-[60vh] min-h-[360px] max-h-[580px] p-4 sm:p-6 overflow-y-auto space-y-4 bg-white"
          >
            {messages.length === 0 && !interimText ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
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
                <p className="text-base font-semibold text-slate-700">
                  Conversation will appear here
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Press &quot;Start Call&quot; to initiate a voice conversation with Riya.
                </p>
              </div>
            ) : (
              <>
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${
                      m.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    {/* Speaker Header with Avatar & Label */}
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      {m.role === "assistant" ? (
                        <>
                          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center text-[10px] font-bold shadow-2xs">
                            R
                          </div>
                          <span className="text-[11px] font-medium text-slate-500">
                            Riya (AI Sales Rep)
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-500">
                          You
                        </span>
                      )}
                    </div>

                    {/* Chat Bubble */}
                    <div
                      className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-2xs ${
                        m.role === "user"
                          ? "bg-indigo-600 text-white rounded-br-xs"
                          : "bg-slate-100 text-slate-800 border border-slate-200/80 rounded-bl-xs"
                      }`}
                    >
                      {m.content}
                    </div>

                    {/* Timestamp under bubble */}
                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                      {m.timestamp}
                    </span>
                  </div>
                ))}

                {/* Live Partial Speech Bubble (Customer Speaking) */}
                {interimText && (
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-indigo-500 font-medium mb-1 px-1 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                      Speaking...
                    </span>
                    <div className="max-w-[85%] sm:max-w-[78%] rounded-2xl rounded-br-xs px-4 py-2.5 text-sm leading-relaxed bg-indigo-50/80 text-indigo-950 border border-dashed border-indigo-200 shadow-2xs italic">
                      {interimText}
                    </div>
                  </div>
                )}

                {/* Typing Indicator Bubble on Bot Side while Thinking */}
                {status === "thinking" && (
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center text-[10px] font-bold shadow-2xs">
                        R
                      </div>
                      <span className="text-[11px] font-medium text-slate-500">
                        Riya (AI Sales Rep)
                      </span>
                    </div>
                    <div className="bg-slate-100 border border-slate-200/80 rounded-2xl rounded-bl-xs px-4 py-3 flex items-center gap-1.5 shadow-2xs">
                      <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce-dot-1"></span>
                      <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce-dot-2"></span>
                      <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce-dot-3"></span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Floating "Jump to latest" Button */}
          {isUserScrolledUp && (
            <button
              type="button"
              onClick={() => {
                setIsUserScrolledUp(false);
                scrollToBottom("smooth");
              }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-indigo-700 bg-white border border-indigo-200 shadow-md hover:bg-indigo-50 active:bg-indigo-100 transition-all cursor-pointer"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3"
                />
              </svg>
              Jump to latest
            </button>
          )}
        </div>

        {/* Headphones Mode Bar */}
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

        {/* Ended Call Slim Summary Banner */}
        {status === "ended" && (
          <div className="px-6 py-2 bg-slate-100/90 border-t border-slate-200 text-center text-xs font-medium text-slate-600">
            Call ended · Duration {formatDuration(durationSeconds)} · {messages.length} messages
          </div>
        )}

        {/* Action Buttons Area */}
        <div className="px-4 sm:px-6 py-4 border-t border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          {/* Start / Start New Call Button */}
          <button
            type="button"
            onClick={startCall}
            disabled={isCallActive || !isSupported}
            className={`w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-xs ${
              !isCallActive && isSupported
                ? "text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                : "text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed opacity-60"
            }`}
          >
            {status === "connecting" ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                Connecting...
              </>
            ) : (
              <>
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
                {status === "ended" ? "Start New Call" : "Start Call"}
              </>
            )}
          </button>

          {/* End Call Button */}
          <button
            type="button"
            onClick={endCall}
            disabled={!isCallActive}
            className={`w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all ${
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
