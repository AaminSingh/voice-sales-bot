import React from "react";
import Link from "next/link";

export default function HistoryPage() {
  return (
    <div className="flex-1 max-w-4xl w-full mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Call History
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Review past sales conversations, audio recordings, and transcripts.
        </p>
      </div>

      {/* Empty State Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-12 text-center flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
          <svg
            className="w-8 h-8"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.8"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h3 className="text-lg font-semibold text-slate-800">
          No calls yet. Start your first call from the Call Screen.
        </h3>
        <p className="text-sm text-slate-500 mt-2 max-w-md">
          Once you start conversations with prospective leads, summary notes, durations, and key discussion points will appear here.
        </p>

        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-xs"
          >
            Go to Call Screen
          </Link>
        </div>
      </div>
    </div>
  );
}
