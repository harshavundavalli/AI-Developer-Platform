import { huggingFaceProvider } from "./huggingface";
import { geminiProvider } from "./gemini";
import type { LLMProvider } from "@/types";

// Central LLM instance — swap provider here to change models
export const llm: LLMProvider = huggingFaceProvider;

export { geminiProvider, huggingFaceProvider };
