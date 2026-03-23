import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import type { LLMProvider, LLMOptions } from "@/types";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY not set — LLM features will not work");
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

/**
 * Rate limiter for Gemini free tier (15 RPM).
 */
class RateLimiter {
  private timestamps: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 14, windowMs: number = 60_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const oldestInWindow = this.timestamps[0];
      const waitTime = this.windowMs - (now - oldestInWindow) + 100;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return this.waitForSlot();
    }

    this.timestamps.push(now);
  }
}

const rateLimiter = new RateLimiter();

function getChatModel(): GenerativeModel {
  if (!genAI) throw new Error("Gemini API key not configured");
  return genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
}

function getEmbeddingModel(): GenerativeModel {
  if (!genAI) throw new Error("Gemini API key not configured");
  return genAI.getGenerativeModel({ model: "gemini-embedding-001" });
}

export const geminiProvider: LLMProvider = {
  /**
   * Stream a response from Gemini.
   */
  async *generateResponse(
    prompt: string,
    context: string,
    options: LLMOptions = {}
  ): AsyncGenerator<string> {
    await rateLimiter.waitForSlot();

    const model = getChatModel();
    const systemPrompt =
      options.systemPrompt ||
      `You are an expert AI code assistant. You help developers understand their codebase by answering questions grounded in the actual source code provided as context.

Rules:
- Always reference specific file paths and line numbers when relevant.
- If the context doesn't contain enough information, say so honestly.
- Format code snippets with proper syntax highlighting using markdown.
- Be concise but thorough.`;

    const fullPrompt = `${systemPrompt}

--- CODEBASE CONTEXT ---
${context}
--- END CONTEXT ---

User question: ${prompt}`;

    const result = await model.generateContentStream({
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.3,
        maxOutputTokens: options.maxTokens ?? 4096,
      },
    });

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  },

  /**
   * Generate a single embedding vector.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    await rateLimiter.waitForSlot();

    const model = getEmbeddingModel();
    const result = await model.embedContent({ content: { parts: [{ text }] }, outputDimensionality: 768 } as any);
    return result.embedding.values;
  },

  /**
   * Generate embeddings for multiple texts in a batch.
   */
  async generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
    await rateLimiter.waitForSlot();

    const model = getEmbeddingModel();
    const result = await model.batchEmbedContents({
      requests: texts.map((text) => ({
        content: { role: "user", parts: [{ text }] },
        outputDimensionality: 768,
      })),
    } as any);
    return result.embeddings.map((e: any) => e.values);
  },
};
