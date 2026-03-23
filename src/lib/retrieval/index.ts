import { findSimilarChunks } from "@/lib/db/vectors";
import { embedQuery } from "@/lib/embedding";

export interface RetrievedContext {
  chunks: Array<{
    chunkId: string;
    filePath: string;
    content: string;
    language: string;
    startLine: number;
    endLine: number;
    chunkType: string;
    similarity: number;
  }>;
  assembledContext: string;
}

/**
 * Retrieve relevant code chunks for a query and assemble them into context.
 */
export async function retrieveContext(
  query: string,
  repoId: string,
  topK: number = 10,
  threshold: number = 0.3
): Promise<RetrievedContext> {
  // Embed the query
  const queryEmbedding = await embedQuery(query);

  // Search for similar chunks
  const chunks = await findSimilarChunks(
    queryEmbedding,
    repoId,
    topK,
    threshold
  );

  // Assemble context string for the LLM
  const assembledContext = chunks
    .map(
      (chunk, idx) =>
        `--- Source ${idx + 1}: ${chunk.filePath} (lines ${chunk.startLine}-${chunk.endLine}) [${chunk.chunkType}] ---
\`\`\`${chunk.language}
${chunk.content}
\`\`\``
    )
    .join("\n\n");

  return { chunks, assembledContext };
}

/**
 * Retrieve context specifically for a file path.
 */
export async function retrieveFileContext(
  filePath: string,
  repoId: string
): Promise<RetrievedContext> {
  return retrieveContext(`code in file ${filePath}`, repoId, 15, 0.2);
}
