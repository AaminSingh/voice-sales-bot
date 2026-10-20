"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AudioEngine, RecordedAudioResult } from "@/lib/audioEngine";
import { uploadRecording } from "@/lib/uploadRecording";

// Tunable delay (in milliseconds) of silence before treating customer speech as a completed turn
export const END_OF_TURN_SILENCE_MS = 1800;
export const SILENCE_DELAY_MS = END_OF_TURN_SILENCE_MS;

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

export type RecordingStatus =
  | "idle"
  | "recording"
  | "uploading"
  | "uploaded"
  | "failed";

export interface CallMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface CallRecording {
  blob: Blob;
  localUrl: string;
  mimeType: string;
  durationMs: number;
  fileName: string;
}

function getCurrentTimestamp(): string {
  const now = new Date();
  return now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const mm = String(mins).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");

  if (hrs > 0) {
    return `${hrs}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
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
  const [durationSeconds, setDurationSeconds] = useState(0);

  // Phase 5 state: Consent, Audio Recording & Playback
  const [consentGiven, setConsentGiven] = useState(false);
  const [consentTimestamp, setConsentTimestamp] = useState<string | null>(null);
  const [recording, setRecording] = useState<CallRecording | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>("idle");
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [ttsFallbackUsed, setTtsFallbackUsed] = useState(false);

  // Lazy initializer to verify browser support
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

  // AudioEngine & Recording refs
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const localRecordingUrlRef = useRef<string | null>(null);
  const latestRecordingBlobRef = useRef<{ blob: Blob; mimeType: string } | null>(null);
  const currentTtsControllerRef = useRef<AbortController | null>(null);

  // Timer refs
  const callStartTimeRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Web Speech refs
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

  // Stop timer and record final duration
  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (callStartTimeRef.current) {
      const elapsedMs = Date.now() - callStartTimeRef.current;
      setDurationSeconds(Math.floor(elapsedMs / 1000));
    }
    console.log("[voice] Call timer stopped");
  }, []);

  // Start timer computing elapsed time from Date.now()
  const startTimer = useCallback(() => {
    stopTimer();
    callStartTimeRef.current = Date.now();
    setDurationSeconds(0);
    console.log("[voice] Call timer started");

    timerIntervalRef.current = setInterval(() => {
      if (callStartTimeRef.current) {
        const elapsedMs = Date.now() - callStartTimeRef.current;
        setDurationSeconds(Math.floor(elapsedMs / 1000));
      }
    }, 1000);
  }, [stopTimer]);

  // Check Hindi voice availability for speechSynthesis fallback
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

  // Find the most suitable voice for speech synthesis fallback
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
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("already started")) {
        console.warn("[voice] Recognition start warning:", err);
      }
    }
  }, []);

  // End Call handler
  const endCall = useCallback(() => {
    console.log("[voice] Ending voice call");
    isCallActiveRef.current = false;
    isSpeakingRef.current = false;
    isHandlingTurnRef.current = false;

    // Stop timer and retain final duration
    stopTimer();

    // Abort in-flight network requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (currentTtsControllerRef.current) {
      currentTtsControllerRef.current.abort();
      currentTtsControllerRef.current = null;
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

    // Stop bot audio in AudioEngine
    if (audioEngineRef.current) {
      audioEngineRef.current.stopBotAudio();
    }

    // Stop browser speechSynthesis & empty sentence queue
    utteranceQueueRef.current = [];
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    // Stop speech recognition
    stopRecognition();

    updateStatus("ended");
    setInterimText("");

    // Stop MediaRecorder, capture blob, and initiate Supabase upload
    if (audioEngineRef.current) {
      const engine = audioEngineRef.current;
      engine
        .stopRecording()
        .then(async (result: RecordedAudioResult) => {
          const { blob, mimeType, durationMs } = result;

          // Dispose engine to release mic hardware immediately
          engine.dispose();
          audioEngineRef.current = null;

          // Check for very short call (< 2 seconds or empty blob)
          if (!blob || blob.size === 0 || durationMs < 2000) {
            console.log("[voice] Call too short to save recording (< 2s)");
            setRecording(null);
            setRecordingStatus("idle");
            setRecordingError("Recording too short to save.");
            return;
          }

          // Revoke previous local URL if exists
          if (localRecordingUrlRef.current) {
            URL.revokeObjectURL(localRecordingUrlRef.current);
          }

          const localUrl = URL.createObjectURL(blob);
          localRecordingUrlRef.current = localUrl;
          latestRecordingBlobRef.current = { blob, mimeType };

          const ext = mimeType.includes("mp4") ? "mp4" : "webm";
          const fileName = `call-recording-${Date.now()}.${ext}`;

          setRecording({ blob, localUrl, mimeType, durationMs, fileName });
          setRecordingStatus("uploading");
          setRecordingError(null);

          try {
            const publicUrl = await uploadRecording(blob, mimeType);
            setRecordingUrl(publicUrl);
            setRecordingStatus("uploaded");
            console.log("[voice] Recording uploaded successfully:", publicUrl);
          } catch (uploadErr: unknown) {
            console.error("[voice] Recording upload error:", uploadErr);
            const msg =
              uploadErr instanceof Error
                ? uploadErr.message
                : "Failed to upload recording to cloud storage";
            setRecordingStatus("failed");
            setRecordingError(msg);
          }
        })
        .catch((err) => {
          console.error("[voice] Error stopping recording:", err);
          engine.dispose();
          audioEngineRef.current = null;
        });
    }
  }, [stopRecognition, stopTimer, updateStatus]);

  // Interrupt current bot speech and resume listening
  const interrupt = useCallback(() => {
    console.log("[voice] Interrupting bot speech");

    if (currentTtsControllerRef.current) {
      currentTtsControllerRef.current.abort();
      currentTtsControllerRef.current = null;
    }

    if (audioEngineRef.current) {
      audioEngineRef.current.stopBotAudio();
    }

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

  // Fallback: browser SpeechSynthesis playback (sentence-by-sentence)
  const speakWithSpeechSynthesisFallback = useCallback(
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

  // Primary speech playback using /api/tts + AudioEngine with 8s timeout and fallback
  const speakText = useCallback(
    async (fullText: string) => {
      if (!isCallActiveRef.current) return;

      const trimmed = fullText.trim();
      if (!trimmed) {
        if (isCallActiveRef.current) {
          updateStatus("listening");
          startRecognition();
        }
        return;
      }

      isSpeakingRef.current = true;
      updateStatus("speaking");

      if (!headphonesModeRef.current) {
        stopRecognition();
      }

      // Try /api/tts with 8-second timeout
      const controller = new AbortController();
      currentTtsControllerRef.current = controller;
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 8000);

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: trimmed.slice(0, 590),
            language: languageRef.current,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData.error || `TTS API returned status ${res.status}`
          );
        }

        const wavBytes = await res.arrayBuffer();

        if (!isCallActiveRef.current) {
          isSpeakingRef.current = false;
          return;
        }

        if (audioEngineRef.current) {
          await audioEngineRef.current.playBotAudio(wavBytes);
        }

        currentTtsControllerRef.current = null;

        if (isCallActiveRef.current) {
          isSpeakingRef.current = false;
          updateStatus("listening");
          startRecognition();
        }
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        currentTtsControllerRef.current = null;

        if (!isCallActiveRef.current) {
          isSpeakingRef.current = false;
          return;
        }

        const isAbort =
          err instanceof DOMException && err.name === "AbortError";
        if (isAbort && !isCallActiveRef.current) {
          return;
        }

        console.warn(
          "[voice] /api/tts failed or timed out. Falling back to browser speechSynthesis:",
          err
        );

        // Mark fallback used so notice is shown
        setTtsFallbackUsed(true);

        // Use browser SpeechSynthesis fallback
        speakWithSpeechSynthesisFallback(trimmed);
      }
    },
    [
      speakWithSpeechSynthesisFallback,
      startRecognition,
      stopRecognition,
      updateStatus,
    ]
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
        timestamp: getCurrentTimestamp(),
      };

      const previousHistory = [...messagesRef.current];
      const optimisticHistory = [...previousHistory, userMsg];

      setMessages(optimisticHistory);
      updateStatus("thinking");

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
          timestamp: getCurrentTimestamp(),
        };

        const confirmedHistory = [...previousHistory, userMsg, assistantMsg];
        messagesRef.current = confirmedHistory;
        setMessages(confirmedHistory);

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

        stopTimer();

        messagesRef.current = previousHistory;
        setMessages(previousHistory);
        setError(errMsg);

        const fallbackText =
          languageRef.current === "hi"
            ? "माफ़ कीजिये, कनेक्शन में समस्या आई। क्या आप दोबारा कह सकते हैं?"
            : "Sorry, I had a connection issue. Could you repeat that?";

        speakText(fallbackText);
      }
    },
    [speakText, stopRecognition, stopTimer, updateStatus]
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

      // Voice interruption trigger in headphones mode
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

      // Reset silence detection timer (1800ms)
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
        }, END_OF_TURN_SILENCE_MS);
      }
    };

    recognition.onend = () => {
      isRecognizingRef.current = false;

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

  // Start Call handler (triggered directly after consent is granted)
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

    // Record consent timestamp
    setConsentGiven(true);
    setConsentTimestamp(new Date().toISOString());

    // Revoke previous recording URL
    if (localRecordingUrlRef.current) {
      URL.revokeObjectURL(localRecordingUrlRef.current);
      localRecordingUrlRef.current = null;
    }
    setRecording(null);
    setRecordingStatus("idle");
    setRecordingUrl(null);
    setRecordingError(null);
    setTtsFallbackUsed(false);

    // Initialize AudioEngine (captures mic and resumes AudioContext inside user gesture)
    try {
      if (audioEngineRef.current) {
        audioEngineRef.current.dispose();
      }
      const engine = new AudioEngine();
      await engine.init();
      audioEngineRef.current = engine;
    } catch (micErr: unknown) {
      console.error("[voice] Microphone initialization error:", micErr);
      const msg =
        micErr instanceof Error
          ? micErr.message
          : "Microphone permission denied. Please allow microphone access and try again.";
      setError(msg);
      updateStatus("error");
      return;
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
    setDurationSeconds(0);
    callStartTimeRef.current = null;
    stopTimer();
    updateStatus("connecting");

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
        timestamp: getCurrentTimestamp(),
      };

      messagesRef.current = [greetingMsg];
      setMessages([greetingMsg]);

      // Timer starts when the call becomes "live" (greeting begins speaking)
      startTimer();

      // Start MediaRecorder right when greeting starts
      if (audioEngineRef.current) {
        audioEngineRef.current.startRecording();
        setRecordingStatus("recording");
      }

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
      stopTimer();
      setError(errMsg);
      updateStatus("error");

      if (audioEngineRef.current) {
        audioEngineRef.current.dispose();
        audioEngineRef.current = null;
      }
    }
  }, [speakText, startTimer, stopTimer, updateStatus]);

  // Retry recording upload
  const retryUpload = useCallback(async () => {
    if (!latestRecordingBlobRef.current) return;
    const { blob, mimeType } = latestRecordingBlobRef.current;
    setRecordingStatus("uploading");
    setRecordingError(null);
    try {
      const publicUrl = await uploadRecording(blob, mimeType);
      setRecordingUrl(publicUrl);
      setRecordingStatus("uploaded");
    } catch (err: unknown) {
      console.error("[voice] Retry upload failed:", err);
      setRecordingStatus("failed");
      setRecordingError(
        err instanceof Error ? err.message : "Upload failed"
      );
    }
  }, []);

  // Handle page unload to release mic hardware immediately
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (audioEngineRef.current) {
        audioEngineRef.current.dispose();
        audioEngineRef.current = null;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Clean up on unmount or navigate away
  useEffect(() => {
    return () => {
      isCallActiveRef.current = false;
      isHandlingTurnRef.current = false;
      stopTimer();
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (currentTtsControllerRef.current) currentTtsControllerRef.current.abort();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);

      if (audioEngineRef.current) {
        audioEngineRef.current.dispose();
        audioEngineRef.current = null;
      }

      if (localRecordingUrlRef.current) {
        URL.revokeObjectURL(localRecordingUrlRef.current);
        localRecordingUrlRef.current = null;
      }

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
  }, [stopTimer]);

  return {
    status,
    messages,
    interimText,
    durationSeconds,
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
    // Phase 5 additions
    recording,
    recordingStatus,
    recordingUrl,
    recordingError,
    consentGiven,
    consentTimestamp,
    ttsFallbackUsed,
    retryUpload,
  };
}
