"use client";

import React, { useState, useEffect, useRef } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function TestChatPage() {
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const initGreeting = async (lang: "en" | "hi") => {
    setIsLoading(true);
    setError(null);
    setMessages([]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [], language: lang }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start call");
      }

      setMessages([{ role: "assistant", content: data.reply }]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error connecting to AI");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initGreeting(language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLanguageChange = (newLang: "en" | "hi") => {
    setLanguage(newLang);
    initGreeting(newLang);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: trimmedInput },
    ];

    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, language }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Server returned an error");
      }

      setMessages([...newMessages, { role: "assistant", content: data.reply }]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error generating reply");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto py-6 px-4 flex flex-col h-[calc(100vh-4rem)]">
      {/* Top Controls Bar */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 mb-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div>
          <h1 className="text-base font-bold text-slate-800">
            Internal Test Chat (Phase 2 LLM Backend)
          </h1>
          <p className="text-xs text-slate-500">
            Testing Riya&apos;s responses, discovery flow, objections, and language switching.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <label htmlFor="languageSelect" className="font-medium">
              Language:
            </label>
            <select
              id="languageSelect"
              value={language}
              onChange={(e) =>
                handleLanguageChange(e.target.value as "en" | "hi")
              }
              disabled={isLoading}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="en">English (Indian)</option>
              <option value="hi">Hindi (Devanagari)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => initGreeting(language)}
            disabled={isLoading}
            className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
          >
            Start / Reset
          </button>
        </div>
      </div>

      {/* Error Message Alert */}
      {error && (
        <div className="mb-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-500 hover:text-rose-800 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Chat Messages Window */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 p-4 overflow-y-auto space-y-3 shadow-2xs">
        {messages.map((m, index) => (
          <div
            key={index}
            className={`flex flex-col ${
              m.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <span className="text-[10px] text-slate-400 font-medium mb-1 px-1">
              {m.role === "user" ? "Customer" : "Riya (AI Sales Rep)"}
            </span>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-2xs ${
                m.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-xs"
                  : "bg-slate-100 text-slate-800 border border-slate-200/70 rounded-bl-xs"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex flex-col items-start">
            <span className="text-[10px] text-slate-400 font-medium mb-1 px-1">
              Riya (AI Sales Rep)
            </span>
            <div className="bg-slate-100 border border-slate-200/70 text-slate-500 rounded-2xl rounded-bl-xs px-4 py-2.5 text-sm flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Text Input & Send Form */}
      <form
        onSubmit={handleSendMessage}
        className="mt-3 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            language === "hi"
              ? "अपना संदेश लिखें (जैसे: हम 10 लोगों की टीम हैं)..."
              : "Type a response as the customer (e.g., We have a team of 10)..."
          }
          disabled={isLoading}
          className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-2xs"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors shadow-2xs"
        >
          Send
        </button>
      </form>
    </div>
  );
}
