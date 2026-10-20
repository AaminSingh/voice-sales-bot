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
  try {
    let body: ChatRequestBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body." },
        { status: 400 }
      );
    }

    const { messages, language = "en" } = body;

    // Validate language
    if (language !== "en" && language !== "hi") {
      return NextResponse.json(
        { error: "Invalid language. Allowed values are 'en' or 'hi'." },
        { status: 400 }
      );
    }

    // Validate messages is an array
    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: "The 'messages' field must be an array." },
        { status: 400 }
      );
    }

    // Validate each message
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg || typeof msg !== "object") {
        return NextResponse.json(
          { error: `Message at index ${i} is not a valid object.` },
          { status: 400 }
        );
      }
      if (msg.role !== "user" && msg.role !== "assistant") {
        return NextResponse.json(
          {
            error: `Invalid role at index ${i}. Allowed roles are 'user' or 'assistant'.`,
          },
          { status: 400 }
        );
      }
      if (typeof msg.content !== "string") {
        return NextResponse.json(
          { error: `Message content at index ${i} must be a string.` },
          { status: 400 }
        );
      }
      if (msg.content.length > 1000) {
        return NextResponse.json(
          {
            error: `Message content at index ${i} exceeds maximum limit of 1000 characters.`,
          },
          { status: 400 }
        );
      }
    }

    // Check API key (server-side only, never logged or leaked)
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      console.error("Gemini API key is missing in environment variables.");
      return NextResponse.json(
        {
          error:
            "Gemini API key is not configured on the server. Please add GEMINI_API_KEY to your .env.local file.",
        },
        { status: 500 }
      );
    }

    const modelName = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

    // Keep only the last 20 messages to keep requests small
    const recentMessages = messages.slice(-20);

    // Map messages to Gemini format (role 'user' or 'model')
    const geminiContents: { role: "user" | "model"; parts: { text: string }[] }[] = [];

    if (recentMessages.length === 0) {
      // Empty messages: call just connected, trigger bot opening greeting
      geminiContents.push({
        role: "user",
        parts: [
          {
            text: "[The call has just connected. Greet the customer and introduce yourself.]",
          },
        ],
      });
    } else {
      // Gemini requires conversation to begin with a 'user' turn
      if (recentMessages[0].role === "assistant") {
        geminiContents.push({
          role: "user",
          parts: [
            {
              text: "[The call has just connected. Greet the customer and introduce yourself.]",
            },
          ],
        });
      }

      for (const m of recentMessages) {
        geminiContents.push({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        });
      }
    }

    const ai = new GoogleGenAI({ apiKey });
    const systemPrompt = buildSystemPrompt(language);

    let response;
    try {
      response = await ai.models.generateContent({
        model: modelName,
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
    } catch (modelErr: unknown) {
      const errMsg = modelErr instanceof Error ? modelErr.message : String(modelErr);
      // Gracefully handle model retirement/fallback (e.g., gemini-2.5-flash deprecated in favor of gemini-3.8-flash)
      if (
        errMsg.includes("no longer available") ||
        errMsg.includes("404") ||
        errMsg.includes("NOT_FOUND")
      ) {
        console.warn(`Model ${modelName} unavailable, falling back to gemini-3.8-flash`);
        response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
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
      } else {
        throw modelErr;
      }
    }

    const reply = stripMarkdown(response.text || "");

    return NextResponse.json({ reply });
  } catch (err: unknown) {
    // Log server error without exposing secrets
    console.error("Error during Gemini chat API execution:", err);

    const errorMessage = err instanceof Error ? err.message : String(err);
    const isRateLimit =
      errorMessage.includes("429") ||
      errorMessage.includes("RESOURCE_EXHAUSTED") ||
      errorMessage.toLowerCase().includes("quota") ||
      errorMessage.toLowerCase().includes("rate limit");

    if (isRateLimit) {
      return NextResponse.json(
        { error: "The AI is busy, please try again." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while communicating with the AI. Please try again.",
      },
      { status: 500 }
    );
  }
}
