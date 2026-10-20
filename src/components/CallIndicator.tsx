"use client";

import React from "react";
import { CallStatus } from "@/hooks/useVoiceCall";

interface CallIndicatorProps {
  status: CallStatus;
}

export default function CallIndicator({ status }: CallIndicatorProps) {
  return (
    <div className="h-[92px] w-full flex flex-col items-center justify-center border-b border-slate-100 bg-slate-50/50 transition-colors">
      {status === "listening" && (
        <div className="flex flex-col items-center justify-center">
          <div className="relative flex items-center justify-center w-11 h-11 mb-1">
            {/* Pulsing ring animation */}
            <div className="absolute inset-0 rounded-full bg-emerald-400/35 animate-ripple"></div>
            <div className="relative z-10 w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </div>
          </div>
          <span className="text-xs font-semibold text-emerald-700 tracking-wide">
            Listening...
          </span>
        </div>
      )}

      {status === "thinking" && (
        <div className="flex flex-col items-center justify-center">
          <div className="flex items-center gap-1.5 h-10 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-bounce-dot-1"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-bounce-dot-2"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-bounce-dot-3"></span>
          </div>
          <span className="text-xs font-semibold text-amber-700 tracking-wide">
            Riya is thinking...
          </span>
        </div>
      )}

      {status === "speaking" && (
        <div className="flex flex-col items-center justify-center">
          <div className="flex items-center gap-1 h-10 mb-1">
            <span className="w-1 rounded-full bg-indigo-600 animate-wave-1"></span>
            <span className="w-1 rounded-full bg-indigo-600 animate-wave-2"></span>
            <span className="w-1 rounded-full bg-indigo-600 animate-wave-3"></span>
            <span className="w-1 rounded-full bg-indigo-600 animate-wave-4"></span>
            <span className="w-1 rounded-full bg-indigo-600 animate-wave-5"></span>
            <span className="w-1 rounded-full bg-indigo-600 animate-wave-6"></span>
            <span className="w-1 rounded-full bg-indigo-600 animate-wave-7"></span>
          </div>
          <span className="text-xs font-semibold text-indigo-700 tracking-wide">
            Riya is speaking...
          </span>
        </div>
      )}

      {status === "connecting" && (
        <div className="flex flex-col items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin mb-1"></div>
          <span className="text-xs font-medium text-amber-700 tracking-wide">
            Connecting to Riya...
          </span>
        </div>
      )}

      {(status === "idle" || status === "ended" || status === "error") && (
        <div className="flex flex-col items-center justify-center text-slate-400">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mb-1 text-slate-400">
            {status === "ended" ? (
              <svg
                className="w-4 h-4 text-slate-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 2v4M8 2v4M3 10h18" />
                <rect x="3" y="4" width="18" height="18" rx="2" />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            )}
          </div>
          <span className="text-xs font-medium text-slate-500">
            {status === "ended"
              ? "Call ended"
              : status === "error"
              ? "Call interrupted"
              : "Ready to call"}
          </span>
        </div>
      )}
    </div>
  );
}
