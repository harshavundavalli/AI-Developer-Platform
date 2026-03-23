// ─── Repository Types ───

export interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string; avatar_url: string };
  description: string | null;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  private: boolean;
  html_url: string;
  updated_at: string;
}

export interface RepoWithStats {
  id: string;
  fullName: string;
  name: string;
  owner: string;
  description: string | null;
  language: string | null;
  stars: number;
  isPrivate: boolean;
  status: "PENDING" | "INGESTING" | "READY" | "ERROR" | "STALE";
  totalChunks: number;
  totalFiles: number;
  lastSyncedAt: string | null;
}

// ─── Ingestion Types ───

export interface IngestionProgress {
  jobId: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  progress: number;
  total: number;
  error?: string;
  phase: string;
}

export interface CodeChunkData {
  filePath: string;
  startLine: number;
  endLine: number;
  chunkType: string;
  content: string;
  language: string;
}

// ─── Chat / Query Types ───

export interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  contextChunks: string[];
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  repoId: string;
  repoName: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QueryRequest {
  query: string;
  conversationId?: string;
}

export interface QueryResponse {
  answer: string;
  sources: Array<{
    filePath: string;
    startLine: number;
    endLine: number;
    content: string;
    similarity: number;
  }>;
  conversationId: string;
}

// ─── Analysis Types ───

export interface CodeReviewResult {
  summary: string;
  issues: Array<{
    severity: "critical" | "warning" | "suggestion" | "praise";
    line?: number;
    message: string;
    suggestion?: string;
  }>;
  overallScore: number;
}

export interface BugExplanation {
  rootCause: string;
  explanation: string;
  suggestedFix: string;
  relatedFiles: string[];
}

export interface DocGenResult {
  documentation: string;
  format: "jsdoc" | "markdown" | "readme";
}

// ─── API Response Types ───

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── LLM Types ───

export interface LLMProvider {
  generateResponse(
    prompt: string,
    context: string,
    options?: LLMOptions
  ): AsyncGenerator<string>;
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddingBatch(texts: string[]): Promise<number[][]>;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}
