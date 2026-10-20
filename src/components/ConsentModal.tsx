"use client";

import React, { useEffect, useRef } from "react";

interface ConsentModalProps {
  isOpen: boolean;
  onAgree: () => void;
  onCancel: () => void;
  isStarting?: boolean;
}

export function ConsentModal({
  isOpen,
  onAgree,
  onCancel,
  isStarting = false,
}: ConsentModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const agreeBtnRef = useRef<HTMLButtonElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Focus the agree button when modal opens
  useEffect(() => {
    if (isOpen) {
      // Delay slightly for render completion
      const timer = setTimeout(() => {
        agreeBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle Escape key and focus trapping
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!isStarting) {
          onCancel();
        }
      } else if (e.key === "Tab") {
        const focusable = [agreeBtnRef.current, cancelBtnRef.current].filter(
          Boolean
        ) as HTMLButtonElement[];
        if (focusable.length < 2) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel, isStarting]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isStarting) {
          onCancel();
        }
      }}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-modal-title"
        aria-describedby="consent-modal-desc"
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 sm:p-7 text-left"
      >
        {/* Header Icon & Title */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" strokeWidth="2" />
              <circle cx="12" cy="12" r="4" fill="currentColor" />
            </svg>
          </div>
          <h2
            id="consent-modal-title"
            className="text-lg font-bold text-slate-900"
          >
            Recording consent
          </h2>
        </div>

        {/* Description */}
        <p
          id="consent-modal-desc"
          className="text-sm text-slate-600 leading-relaxed mb-6"
        >
          This call will be recorded for quality and training purposes. Do you agree?
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            disabled={isStarting}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            ref={agreeBtnRef}
            type="button"
            onClick={onAgree}
            disabled={isStarting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm shadow-emerald-600/30 transition-all hover:shadow-md disabled:opacity-50"
          >
            {isStarting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Connecting...
              </>
            ) : (
              "Agree & Start Call"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
