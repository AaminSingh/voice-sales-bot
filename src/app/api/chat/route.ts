import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { buildSystemPrompt } from "@/lib/salesPrompt";

interface ClientMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequestBody {
  messages: ClientMessage[];
  language?: "en" | "hi";
}

function stripMarkdown(text: string): string {
  return text
    .replace(/[*#`_~>]/g, "")
    .replace(/^\s*[-+*]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  let apiKey: string | undefined;
  try {
    let body: ChatRequestBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body.", statusCode: 400 },
        { status: 400 }
      );
    }

    const { messages, language = "en" } = body;

    // Validate language
    if (language !== "en" && language !== "hi") {
      return NextResponse.json(
        { error: "Invalid language. Allowed values are 'en' or 'hi'.", statusCode: 400 },
        { status: 400 }
      );
    }

    // Validate messages is an array
    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: "The 'messages' field must be an array.", statusCode: 400 },
        { status: 400 }
      );
    }

    // Validate each message
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg || typeof msg !== "object") {
        return NextResponse.json(
          { error: `Message at index ${i} is not a valid object.`, statusCode: 400 },
          { status: 400 }
        );
      }
      if (msg.role !== "user" && msg.role !== "assistant") {
        return NextResponse.json(
          {
            error: `Invalid role at index ${i}. Allowed roles are 'user' or 'assistant'.`,
            statusCode: 400,
          },
          { status: 400 }
        );
      }
      if (typeof msg.content !== "string") {
        return NextResponse.json(
          { error: `Message content at index ${i} must be a string.`, statusCode: 400 },
          { status: 400 }
        );
      }
      if (msg.content.length > 1000) {
        return NextResponse.json(
          {
            error: `Message content at index ${i} exceeds maximum limit of 1000 characters.`,
            statusCode: 400,
          },
          { status: 400 }
        );
      }
    }

    // Check API key (server-side only, never logged or leaked)
    apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      console.error("Gemini API key is missing in environment variables.");
      return NextResponse.json(
        {
          error:
            "Gemini API key is not configured on the server. Please add GEMINI_API_KEY to your .env.local file.",
          statusCode: 500,
        },
        { status: 500 }
      );
    }

    const requestedModel = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

    // Keep only the last 20 messages to keep requests small
    const recentMessages = messages.slice(-20);

    // Raw Gemini turns: must begin with a user turn
    const rawTurns: { role: "user" | "model"; content: string }[] = [];

    if (recentMessages.length === 0) {
      // Empty messages: call just connected, trigger bot opening greeting
      rawTurns.push({
        role: "user",
        content: "[The call has just connected. Greet the customer and introduce yourself.]",
      });
    } else {
      // If the conversation starts with an assistant message (e.g. the greeting),
      // Gemini requires the conversation to start with a user turn. Always prepend.
      if (recentMessages[0].role === "assistant") {
        rawTurns.push({
          role: "user",
          content: "[The call has just connected. Greet the customer and introduce yourself.]",
        });
      }

      for (const m of recentMessages) {
        rawTurns.push({
          role: m.role === "assistant" ? "model" : "user",
          content: m.content,
        });
      }
    }

    // Merge consecutive messages with the same role into one so roles strictly alternate user/model
    const geminiContents: { role: "user" | "model"; parts: { text: string }[] }[] = [];
    for (const turn of rawTurns) {
      const last = geminiContents[geminiContents.length - 1];
      if (last && last.role === turn.role) {
        const combined = `${last.parts[0]?.text || ""} ${turn.content}`.trim();
        last.parts = [{ text: combined }];
      } else {
        geminiContents.push({
          role: turn.role,
          parts: [{ text: turn.content.trim() }],
        });
      }
    }

    const ai = new GoogleGenAI({ apiKey });
    const systemPrompt = buildSystemPrompt(language);

    // Candidate models to attempt sequentially in case of 404 (model retirement) or 503 (high demand)
    const candidateModels = Array.from(
      new Set([requestedModel, "gemini-3.5-flash", "gemini-3-flash-preview", "gemini-3.8-flash"])
    );

    let response;
    let lastError: unknown;

    for (const model of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: geminiContents,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.7,
            maxOutputTokens: 150,
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        });
        if (response) {
          break;
        }
      } catch (modelErr: unknown) {
        lastError = modelErr;
        const errMsg = modelErr instanceof Error ? modelErr.message : String(modelErr);
        console.warn(`[api/chat] Model ${model} unavailable (${errMsg.slice(0, 100)}), trying next candidate...`);
      }
    }

    if (!response) {
      throw lastError;
    }

    const reply = stripMarkdown(response.text || "");

    return NextResponse.json({ reply });
  } catch (err: unknown) {
    let statusCode = 500;
    let errorMessage = "An unexpected error occurred while communicating with the AI.";

    if (err && typeof err === "object") {
      const anyErr = err as Record<string, unknown>;
      if (typeof anyErr.status === "number") {
        statusCode = anyErr.status;
      } else if (typeof anyErr.statusCode === "number") {
        statusCode = anyErr.statusCode;
      } else if (anyErr.error && typeof anyErr.error === "object") {
        const nested = anyErr.error as Record<string, unknown>;
        if (typeof nested.code === "number") {
          statusCode = nested.code;
        }
      }

      if (typeof anyErr.message === "string") {
        errorMessage = anyErr.message;
      }
    } else if (typeof err === "string") {
      errorMessage = err;
    }

    // Redact API key if it appears anywhere in error message
    if (apiKey) {
      errorMessage = errorMessage.replaceAll(apiKey, "[REDACTED_API_KEY]");
    }

    // Log the real Gemini error including status code and message (never the API key)
    console.error(`[api/chat] Real Gemini Error (Status ${statusCode}): ${errorMessage}`);

    const isRateLimit =
      statusCode === 429 ||
      errorMessage.includes("429") ||
      errorMessage.includes("RESOURCE_EXHAUSTED") ||
      errorMessage.toLowerCase().includes("quota") ||
      errorMessage.toLowerCase().includes("rate limit");

    if (isRateLimit) {
      return NextResponse.json(
        {
          error: "The AI is busy, please try again.",
          statusCode: 429,
          details: errorMessage,
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: errorMessage,
        statusCode: statusCode,
      },
      { status: statusCode >= 400 && statusCode < 600 ? statusCode : 500 }
    );
  }
}
