import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { pcmToWav } from "@/lib/audio";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.text !== "string") {
      return NextResponse.json(
        { error: "Invalid request: text string is required" },
        { status: 400 }
      );
    }

    const text = body.text.trim();
    if (!text || text.length > 600) {
      return NextResponse.json(
        { error: "Invalid text: text must be non-empty and under 600 characters" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[TTS API] Missing GEMINI_API_KEY environment variable");
      return NextResponse.json(
        { error: "Server configuration error: missing GEMINI_API_KEY" },
        { status: 500 }
      );
    }

    const modelName = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
    const voiceName = process.env.GEMINI_TTS_VOICE || "Kore";

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: modelName,
      contents: text,
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName,
            },
          },
        },
      },
    });

    const candidate = response.candidates?.[0];
    const part = candidate?.content?.parts?.find((p) => p.inlineData?.data);
    const base64Audio = part?.inlineData?.data;

    if (!base64Audio) {
      console.error("[TTS API] No audio data received in candidate parts", {
        finishReason: candidate?.finishReason,
      });
      return NextResponse.json(
        { error: "No audio data received from speech service" },
        { status: 502 }
      );
    }

    const pcmBuffer = Buffer.from(base64Audio, "base64");
    let sampleRate = 24000;
    const mime = part.inlineData?.mimeType || "";
    const rateMatch = mime.match(/rate=(\d+)/);
    if (rateMatch) {
      const parsed = parseInt(rateMatch[1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        sampleRate = parsed;
      }
    }

    const wavBuffer = pcmToWav(pcmBuffer, sampleRate, 1, 16);

    return new Response(new Uint8Array(wavBuffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": wavBuffer.length.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    const errorObj = err as Record<string, unknown>;
    const errorMessage = typeof errorObj?.message === "string" ? errorObj.message : String(err);
    const errorStatus = typeof errorObj?.status === "number" ? errorObj.status : undefined;

    console.error("[TTS API Error]:", {
      status: errorStatus,
      message: errorMessage,
    });

    let status = 500;
    if (
      errorStatus === 429 ||
      errorMessage.includes("RESOURCE_EXHAUSTED") ||
      errorMessage.includes("429")
    ) {
      status = 429;
    } else if (errorStatus && errorStatus >= 400 && errorStatus < 600) {
      status = errorStatus;
    }

    return NextResponse.json(
      { error: errorMessage || "TTS generation failed" },
      { status }
    );
  }
}
