import React from "react";

export default function CallPage() {
  return (
    <div className="flex-1 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8 max-w-4xl w-full mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
        {/* Header Area */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-3 w-3 relative">
              <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-400"></span>
            </span>
            <span className="text-sm font-semibold text-slate-700">
              Call Status: <span className="text-slate-900 font-medium">Idle</span>
            </span>
          </div>

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

        {/* Large Chat Panel Area */}
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

        {/* Action Buttons Area */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-center gap-4">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition-colors shadow-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
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

          <button
            type="button"
            disabled
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm text-rose-300 bg-rose-100/60 border border-rose-200/50 cursor-not-allowed opacity-60"
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
