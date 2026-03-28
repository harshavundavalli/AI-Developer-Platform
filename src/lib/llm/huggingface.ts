import { HfInference } from "@huggingface/inference";
import type { LLMProvider, LLMOptions } from "@/types";

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;

if (!HF_API_KEY) {
  console.warn("HUGGINGFACE_API_KEY not set — LLM features will not work");
}

const hf = HF_API_KEY ? new HfInference(HF_API_KEY) : null;

// Instruction-tuned model for chat
const CHAT_MODEL = "Qwen/Qwen2.5-72B-Instruct";

// 768-dim embeddings — matches existing pgvector schema
const EMBEDDING_MODEL = "sentence-transformers/all-mpnet-base-v2";


export const huggingFaceProvider: LLMProvider = {
  async *generateResponse(
    prompt: string,
    context: string,
    options: LLMOptions = {}
  ): AsyncGenerator<string> {
    if (!hf) throw new Error("HuggingFace API key not configured");

    const systemPrompt =
      options.systemPrompt ||
      `You are an expert AI code assistant. You help developers understand their codebase by answering questions grounded in the actual source code provided as context.

Rules:
- Always reference specific file paths and line numbers when relevant.
- If the context doesn't contain enough information, say so honestly.
- Format code snippets with proper syntax highlighting using markdown.
- Be concise but thorough.`;

    const userMessage = context
      ? `--- CODEBASE CONTEXT ---\n${context}\n--- END CONTEXT ---\n\nUser question: ${prompt}`
      : prompt;

    const stream = hf.chatCompletionStream({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.3,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) yield text;
    }
  },

  async generateEmbedding(text: string): Promise<number[]> {
    if (!hf) throw new Error("HuggingFace API key not configured");

    const result = await hf.featureExtraction({
      model: EMBEDDING_MODEL,
      inputs: text,
    });

    // featureExtraction returns number[] or number[][]
    // For a single input it returns number[] (mean pooled)
    if (Array.isArray(result[0])) {
      // If it returned token-level embeddings, mean-pool them
      const matrix = result as number[][];
      const dims = matrix[0].length;
      const mean = new Array(dims).fill(0);
      for (const vec of matrix) {
        for (let i = 0; i < dims; i++) mean[i] += vec[i];
      }
      return mean.map((v) => v / matrix.length);
    }

    return result as number[];
  },

  async generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
    if (!hf) throw new Error("HuggingFace API key not configured");

    const results = await hf.featureExtraction({
      model: EMBEDDING_MODEL,
      inputs: texts,
    });

    // Returns number[][] for batch inputs
    const batch = results as number[][];

    return batch.map((item) => {
      if (Array.isArray(item[0])) {
        // Token-level embeddings — mean pool
        const matrix = item as unknown as number[][];
        const dims = matrix[0].length;
        const mean = new Array(dims).fill(0);
        for (const vec of matrix) {
          for (let i = 0; i < dims; i++) mean[i] += vec[i];
        }
        return mean.map((v) => v / matrix.length);
      }
      return item as number[];
    });
  },
};
