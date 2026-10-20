/**
 * AudioEngine manages the AudioContext, microphone capture, bot audio playback,
 * and mixed audio recording for the voice call.
 *
 * It combines the customer's microphone and the bot's synthesized audio into a single
 * MediaStreamAudioDestinationNode so MediaRecorder can record both sides simultaneously.
 */

export interface RecordedAudioResult {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private mixDestinationNode: MediaStreamAudioDestinationNode | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  private activeSourceResolve: (() => void) | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordingChunks: Blob[] = [];
  private recordingStartTime: number = 0;

  /**
   * Initializes the AudioContext within a user gesture, captures the microphone,
   * and prepares the mixed audio destination.
   */
  async init(): Promise<void> {
    // 1. Create AudioContext
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error("Web Audio API is not supported in this browser.");
    }

    this.audioContext = new AudioContextClass();
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    // 2. Request microphone access
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      if (
        error?.name === "NotAllowedError" ||
        error?.name === "PermissionDeniedError" ||
        error?.message?.toLowerCase().includes("denied")
      ) {
        throw new Error(
          "Microphone permission denied. Please allow microphone access and try again."
        );
      }
      throw new Error(
        `Microphone access failed: ${error?.message || "Unknown error"}`
      );
    }

    // 3. Connect microphone to mixed destination ONLY (not to speakers to avoid feedback)
    this.mixDestinationNode = this.audioContext.createMediaStreamDestination();
    this.micSourceNode = this.audioContext.createMediaStreamSource(this.micStream);
    this.micSourceNode.connect(this.mixDestinationNode);
  }

  /**
   * Decodes and plays bot audio through speakers AND routes it to the recording destination.
   * Resolves when playback completes.
   */
  async playBotAudio(arrayBuffer: ArrayBuffer): Promise<void> {
    this.stopBotAudio();

    if (!this.audioContext || this.audioContext.state === "closed") {
      return;
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    // Decode audio data (use slice to prevent detached buffer issues)
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));

    return new Promise<void>((resolve) => {
      if (!this.audioContext || this.audioContext.state === "closed") {
        return resolve();
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;

      // Connect to speakers so customer can hear it
      source.connect(this.audioContext.destination);

      // Connect to mix destination so it is recorded
      if (this.mixDestinationNode) {
        source.connect(this.mixDestinationNode);
      }

      this.activeSource = source;
      this.activeSourceResolve = resolve;

      source.onended = () => {
        if (this.activeSource === source) {
          this.activeSource = null;
          this.activeSourceResolve = null;
        }
        resolve();
      };

      source.start(0);
    });
  }

  /**
   * Stops active bot audio playback safely.
   */
  stopBotAudio(): void {
    if (this.activeSource) {
      try {
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch {}
      this.activeSource = null;
    }
    if (this.activeSourceResolve) {
      const resolve = this.activeSourceResolve;
      this.activeSourceResolve = null;
      resolve();
    }
  }

  /**
   * Starts MediaRecorder capturing from the mix destination stream.
   */
  startRecording(): void {
    if (!this.mixDestinationNode) {
      console.warn("[AudioEngine] Mix destination not initialized, cannot record");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      console.warn("[AudioEngine] MediaRecorder is not supported in this browser.");
      return;
    }

    // Supported mimeType order
    const mimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    let chosenMimeType = "";
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        chosenMimeType = type;
        break;
      }
    }

    this.recordingChunks = [];
    this.recordingStartTime = Date.now();

    try {
      this.mediaRecorder = chosenMimeType
        ? new MediaRecorder(this.mixDestinationNode.stream, { mimeType: chosenMimeType })
        : new MediaRecorder(this.mixDestinationNode.stream);
    } catch (err) {
      console.error("[AudioEngine] Failed to create MediaRecorder:", err);
      return;
    }

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.recordingChunks.push(event.data);
      }
    };

    try {
      this.mediaRecorder.start(1000); // 1000ms timeslice
    } catch (err) {
      console.error("[AudioEngine] Failed to start MediaRecorder:", err);
    }
  }

  /**
   * Stops recording and returns the merged audio Blob.
   */
  async stopRecording(): Promise<RecordedAudioResult> {
    return new Promise((resolve) => {
      const durationMs = this.recordingStartTime ? Date.now() - this.recordingStartTime : 0;

      if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
        const mimeType = this.mediaRecorder?.mimeType || "audio/webm";
        const blob = new Blob(this.recordingChunks, { type: mimeType });
        return resolve({ blob, mimeType, durationMs });
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || "audio/webm";
        const blob = new Blob(this.recordingChunks, { type: mimeType });
        resolve({ blob, mimeType, durationMs });
      };

      try {
        this.mediaRecorder.stop();
      } catch (err) {
        console.warn("[AudioEngine] Error while stopping MediaRecorder:", err);
        const mimeType = this.mediaRecorder?.mimeType || "audio/webm";
        const blob = new Blob(this.recordingChunks, { type: mimeType });
        resolve({ blob, mimeType, durationMs });
      }
    });
  }

  /**
   * Releases all audio resources and stops microphone hardware access.
   */
  dispose(): void {
    this.stopBotAudio();

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    this.mediaRecorder = null;
    this.recordingChunks = [];

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      this.micStream = null;
    }

    if (this.micSourceNode) {
      try {
        this.micSourceNode.disconnect();
      } catch {}
      this.micSourceNode = null;
    }

    if (this.mixDestinationNode) {
      try {
        this.mixDestinationNode.disconnect();
      } catch {}
      this.mixDestinationNode = null;
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      try {
        this.audioContext.close();
      } catch {}
    }
    this.audioContext = null;
  }
}
