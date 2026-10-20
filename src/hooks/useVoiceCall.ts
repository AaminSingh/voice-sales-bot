"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// Tunable delay (in milliseconds) of silence before treating customer speech as a completed turn
export const SILENCE_DELAY_MS = 1200;

// Minimum transcript characters required to qualify as customer speech
const MIN_TRANSCRIPT_LENGTH = 2;

// Minimum interim characters needed to trigger voice interruption in headphones mode
const INTERRUPTION_MIN_LENGTH = 3;

export type CallStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "ended"
  | "error";

export interface CallMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function splitIntoSentences(text: string): string[] {
  // Splits on English and Hindi sentence boundaries (. ! ? । and newlines)
  const segments = text.match(/[^.!?।\n]+[.!?।\n]+|[^.!?।\n]+$/g) || [text];
  return segments.map((s) => s.trim()).filter((s) => s.length > 0);
}

export function useVoiceCall() {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [messages, setMessages] = useState<CallMessage[]>([]);
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguageState] = useState<"en" | "hi">("en");
  const [headphonesMode, setHeadphonesModeState] = useState(false);
  const [voiceWarning, setVoiceWarning] = useState<string | null>(null);

  // Lazy initializer to avoid setting state synchronously inside an effect
  const [isSupported] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const hasSpeechRec =
      "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
    const hasSpeechSynth = "speechSynthesis" in window;
    return Boolean(hasSpeechRec && hasSpeechSynth);
  });

  // Synchronous refs to prevent stale closures in event handlers
  const statusRef = useRef<CallStatus>("idle");
  const messagesRef = useRef<CallMessage[]>([]);
  const languageRef = useRef<"en" | "hi">("en");
  const headphonesModeRef = useRef(false);
  const isCallActiveRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isRecognizingRef = useRef(false);
  const isHandlingTurnRef = useRef(false);

  // Audio / Speech refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const turnBufferRef = useRef("");
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const restartTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const utteranceQueueRef = useRef<string[]>([]);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Update status both in ref and state
  const updateStatus = useCallback((newStatus: CallStatus) => {
    statusRef.current = newStatus;
    setStatus(newStatus);
    console.log(`[voice] Status changed -> ${newStatus}`);
  }, []);

  // Update language both in ref and state
  const setLanguage = useCallback((lang: "en" | "hi") => {
    languageRef.current = lang;
    setLanguageState(lang);
    if (recognitionRef.current) {
      recognitionRef.current.lang = lang === "hi" ? "hi-IN" : "en-IN";
    }
  }, []);

  // Update headphones mode both in ref and state
  const setHeadphonesMode = useCallback((val: boolean) => {
    headphonesModeRef.current = val;
    setHeadphonesModeState(val);
  }, []);

  // Check Hindi voice availability
  const checkVoices = useCallback((voices: SpeechSynthesisVoice[]) => {
    voicesRef.current = voices;
    if (typeof window === "undefined") return;
    const hasHindi = voices.some(
      (v) =>
        v.lang === "hi-IN" ||
        v.lang.startsWith("hi") ||
        v.name.toLowerCase().includes("hindi")
    );
    if (languageRef.current === "hi" && !hasHindi) {
      setVoiceWarning(
        "No Hindi voice found on this device, so speech may sound unnatural."
      );
    } else {
      setVoiceWarning(null);
    }
  }, []);

  // Find the most suitable voice for speech synthesis
  const getPreferredVoice = useCallback((): SpeechSynthesisVoice | null => {
    const voices = voicesRef.current;
    if (!voices || voices.length === 0) return null;

    const lang = languageRef.current;
    if (lang === "hi") {
      const hiVoice = voices.find(
        (v) =>
          v.lang === "hi-IN" ||
          v.lang.toLowerCase().startsWith("hi") ||
          v.name.toLowerCase().includes("hindi")
      );
      if (hiVoice) return hiVoice;
    } else {
      const enInVoice = voices.find(
        (v) =>
          v.lang === "en-IN" ||
          v.lang.toLowerCase() === "en_in" ||
          v.name.toLowerCase().includes("india")
      );
      if (enInVoice) return enInVoice;

      const enVoice = voices.find(
        (v) => v.lang.startsWith("en") || v.lang.startsWith("en-")
      );
      if (enVoice) return enVoice;
    }

    return voices[0] || null;
  }, []);

  // Stop speech recognition
  const stopRecognition = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (recognitionRef.current && isRecognizingRef.current) {
      try {
        recognitionRef.current.stop();
        console.log("[voice] SpeechRecognition stopped");
      } catch (err) {
        console.warn("[voice] Recognition stop warning:", err);
      }
      isRecognizingRef.current = false;
    }
  }, []);

  // End Call handler (declared early so other callbacks can safely invoke it)
  const endCall = useCallback(() => {
    console.log("[voice] Ending voice call");
    isCallActiveRef.current = false;
    isSpeakingRef.current = false;
    isHandlingTurnRef.current = false;

    // Abort in-flight network requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Clear timers
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    // Stop speech synthesis & empty sentence queue
    utteranceQueueRef.current = [];
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    // Stop speech recognition
    stopRecognition();

    updateStatus("ended");
    setInterimText("");
  }, [stopRecognition, updateStatus]);

  // Start speech recognition with state guards
  const startRecognition = useCallback(() => {
    if (!recognitionRef.current || !isCallActiveRef.current) return;
    if (isRecognizingRef.current) return;

    // Do not start if bot is speaking (unless headphones mode is on) or thinking
    if (isSpeakingRef.current && !headphonesModeRef.current) return;
    if (statusRef.current === "thinking") return;

    try {
      recognitionRef.current.lang =
        languageRef.current === "hi" ? "hi-IN" : "en-IN";
      recognitionRef.current.start();
      isRecognizingRef.current = true;
      console.log("[voice] SpeechRecognition started");
    } catch (err: unknown) {
      // Ignore InvalidStateError if already starting
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("already started")) {
        console.warn("[voice] Recognition start warning:", err);
      }
    }
  }, []);

  // Interrupt current bot speech and resume listening
  const interrupt = useCallback(() => {
    console.log("[voice] Interrupting speech");
    utteranceQueueRef.current = [];
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    isSpeakingRef.current = false;

    if (isCallActiveRef.current) {
      updateStatus("listening");
      startRecognition();
    }
  }, [startRecognition, updateStatus]);

  // Sequential sentence-by-sentence TTS playback to avoid Chrome queue cutoffs
  const speakText = useCallback(
    (fullText: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      if (!isCallActiveRef.current) return;

      const sentences = splitIntoSentences(fullText);
      if (sentences.length === 0) {
        if (isCallActiveRef.current) {
          updateStatus("listening");
          startRecognition();
        }
        return;
      }

      utteranceQueueRef.current = sentences;
      isSpeakingRef.current = true;
      updateStatus("speaking");

      // While bot is speaking, recognition must stop unless headphones mode is enabled
      if (!headphonesModeRef.current) {
        stopRecognition();
      }

      const voice = getPreferredVoice();

      const playNext = () => {
        if (!isCallActiveRef.current) {
          isSpeakingRef.current = false;
          return;
        }

        const nextSentence = utteranceQueueRef.current.shift();
        if (!nextSentence) {
          // All sentences finished: transition to listening
          isSpeakingRef.current = false;
          if (isCallActiveRef.current) {
            updateStatus("listening");
            startRecognition();
          }
          return;
        }

        const utterance = new SpeechSynthesisUtterance(nextSentence);
        if (voice) {
          utterance.voice = voice;
        }
        utterance.lang = languageRef.current === "hi" ? "hi-IN" : "en-IN";
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        utterance.onend = () => {
          playNext();
        };

        utterance.onerror = (e) => {
          // Ignore cancellation caused by interrupt() or endCall()
          if (e.error === "interrupted" || e.error === "canceled") {
            return;
          }
          console.warn("[voice] Utterance error:", e.error);
          playNext();
        };

        try {
          window.speechSynthesis.speak(utterance);
        } catch (err) {
          console.warn("[voice] Error triggering speech synthesis:", err);
          playNext();
        }
      };

      playNext();
    },
    [getPreferredVoice, startRecognition, stopRecognition, updateStatus]
  );

  // Send completed customer turn to LLM
  const handleUserTurn = useCallback(
    async (text: string) => {
      if (!isCallActiveRef.current || isHandlingTurnRef.current) return;
      isHandlingTurnRef.current = true;

      console.log(`[voice] Final customer transcript: "${text}"`);

      // Immediately stop recognition during thinking
      stopRecognition();
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      turnBufferRef.current = "";
      setInterimText("");

      const userMsg: CallMessage = {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : String(Date.now()),
        role: "user",
        content: text,
      };

      // Keep previous clean history for safe rollback on failure
      const previousHistory = [...messagesRef.current];
      const optimisticHistory = [...previousHistory, userMsg];

      // Optimistically display the customer message in the UI
      setMessages(optimisticHistory);
      updateStatus("thinking");

      // Abort previous in-flight requests if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        console.log("[voice] Sending turn to /api/chat");
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: optimisticHistory.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            language: languageRef.current,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!isCallActiveRef.current) {
          isHandlingTurnRef.current = false;
          return;
        }

        const data = await res.json();
        if (!res.ok) {
          const apiErrorMsg =
            data.error ||
            `API error (${data.statusCode || res.status}): Failed to receive response`;
          throw new Error(apiErrorMsg);
        }

        const reply = data.reply as string;
        console.log(`[voice] Received LLM reply: "${reply}"`);

        const assistantMsg: CallMessage = {
          id:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : String(Date.now()),
          role: "assistant",
          content: reply,
        };

        // Commit both user message and assistant reply to official history
        const confirmedHistory = [...previousHistory, userMsg, assistantMsg];
        messagesRef.current = confirmedHistory;
        setMessages(confirmedHistory);

        // Clear any previous error banner on successful reply
        setError(null);
        isHandlingTurnRef.current = false;

        // Speak the reply
        speakText(reply);
      } catch (err: unknown) {
        isHandlingTurnRef.current = false;
        if (!isCallActiveRef.current) return;

        if (err instanceof DOMException && err.name === "AbortError") {
          console.log("[voice] Fetch request aborted");
          return;
        }

        console.error("[voice] Chat API error:", err);
        const errMsg =
          err instanceof Error
            ? err.message
            : "Connection error with AI service.";

        // Roll back messages so the failed customer message does not remain or duplicate
        messagesRef.current = previousHistory;
        setMessages(previousHistory);

        // Show real error text in the error banner
        setError(errMsg);

        // Speak fallback line once per failure (does not loop)
        const fallbackText =
          languageRef.current === "hi"
            ? "माफ़ कीजिये, कनेक्शन में समस्या आई। क्या आप दोबारा कह सकते हैं?"
            : "Sorry, I had a connection issue. Could you repeat that?";

        speakText(fallbackText);
      }
    },
    [speakText, stopRecognition, updateStatus]
  );

  // Initialize SpeechSynthesis voices
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const synth = window.speechSynthesis;
    const loadVoices = () => {
      const list = synth.getVoices();
      if (list.length > 0) {
        checkVoices(list);
      }
    };

    loadVoices();
    synth.addEventListener("voiceschanged", loadVoices);

    return () => {
      synth.removeEventListener("voiceschanged", loadVoices);
    };
  }, [checkVoices]);

  // Initialize SpeechRecognition instance
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognitionClass =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = languageRef.current === "hi" ? "hi-IN" : "en-IN";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (!isCallActiveRef.current) return;

      let currentInterim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        const piece = item[0]?.transcript || "";
        if (item.isFinal) {
          turnBufferRef.current = (
            turnBufferRef.current ? turnBufferRef.current + " " : ""
          ) + piece.trim();
        } else {
          currentInterim += piece;
        }
      }

      const fullLive = (
        (turnBufferRef.current ? turnBufferRef.current + " " : "") +
        currentInterim
      ).trim();

      setInterimText(fullLive);

      // Voice interruption trigger in headphones mode while bot is speaking
      if (
        isSpeakingRef.current &&
        headphonesModeRef.current &&
        fullLive.length >= INTERRUPTION_MIN_LENGTH
      ) {
        console.log(
          `[voice] User interrupted bot via voice in headphones mode: "${fullLive}"`
        );
        interrupt();
      }

      // Reset silence detection timer
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      if (fullLive.length >= MIN_TRANSCRIPT_LENGTH) {
        silenceTimerRef.current = setTimeout(() => {
          silenceTimerRef.current = null;
          const finishedTurn = (
            turnBufferRef.current +
            " " +
            currentInterim
          ).trim();
          turnBufferRef.current = "";
          setInterimText("");

          if (finishedTurn.length >= MIN_TRANSCRIPT_LENGTH) {
            handleUserTurn(finishedTurn);
          }
        }, SILENCE_DELAY_MS);
      }
    };

    recognition.onend = () => {
      isRecognizingRef.current = false;

      // Chrome stops recognition after silence periods even in continuous mode.
      // Automatically restart if call is active and bot is not busy.
      if (isCallActiveRef.current) {
        const canRestart =
          (!isSpeakingRef.current || headphonesModeRef.current) &&
          statusRef.current !== "thinking";

        if (canRestart) {
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          restartTimerRef.current = setTimeout(() => {
            if (
              isCallActiveRef.current &&
              (!isSpeakingRef.current || headphonesModeRef.current) &&
              statusRef.current !== "thinking"
            ) {
              startRecognition();
            }
          }, 100);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn("[voice] Recognition event error:", event.error);

      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        setError(
          "Microphone permission denied. Please allow microphone access and try again."
        );
        endCall();
      } else if (event.error === "network") {
        setError("Speech recognition needs an internet connection.");
      } else if (event.error === "audio-capture") {
        setError("No microphone found.");
      }
      // "no-speech" and "aborted" are intentionally ignored and recover automatically
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, [endCall, handleUserTurn, interrupt, startRecognition]);

  // Start Call handler (triggered directly by user gesture click)
  const startCall = useCallback(async () => {
    if (typeof window === "undefined") return;

    const SpeechRecognitionClass =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass || !("speechSynthesis" in window)) {
      setError(
        "Voice calls need Google Chrome (or Edge) on desktop or Android."
      );
      return;
    }

    // Warm up speech synthesis on user click gesture so browser permits async audio
    try {
      const warmup = new SpeechSynthesisUtterance("");
      window.speechSynthesis.speak(warmup);
    } catch {
      // ignore
    }

    console.log("[voice] Starting voice call...");
    isCallActiveRef.current = true;
    isSpeakingRef.current = false;
    isHandlingTurnRef.current = false;
    messagesRef.current = [];
    setMessages([]);
    setInterimText("");
    turnBufferRef.current = "";
    setError(null);
    updateStatus("connecting");

    // Abort previous controller if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      // Call /api/chat with empty messages array to trigger opening greeting
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [], language: languageRef.current }),
        signal: abortControllerRef.current.signal,
      });

      if (!isCallActiveRef.current) return;

      const data = await res.json();
      if (!res.ok) {
        const apiErrorMsg =
          data.error ||
          `API error (${data.statusCode || res.status}): Failed to start call with AI agent.`;
        throw new Error(apiErrorMsg);
      }

      const greeting = data.reply as string;
      console.log(`[voice] Received greeting: "${greeting}"`);

      const greetingMsg: CallMessage = {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : String(Date.now()),
        role: "assistant",
        content: greeting,
      };

      messagesRef.current = [greetingMsg];
      setMessages([greetingMsg]);

      // Speak opening greeting (onend will transition to listening)
      speakText(greeting);
    } catch (err: unknown) {
      if (!isCallActiveRef.current) return;

      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }

      console.error("[voice] Error starting call:", err);
      const errMsg =
        err instanceof Error
          ? err.message
          : "Could not connect to the sales agent.";
      setError(errMsg);
      updateStatus("error");
    }
  }, [speakText, updateStatus]);

  // Clean up on unmount or navigate away
  useEffect(() => {
    return () => {
      isCallActiveRef.current = false;
      isHandlingTurnRef.current = false;
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    status,
    messages,
    interimText,
    error,
    clearError: () => setError(null),
    isSupported,
    language,
    setLanguage,
    headphonesMode,
    setHeadphonesMode,
    voiceWarning,
    startCall,
    endCall,
    interrupt,
  };
}
