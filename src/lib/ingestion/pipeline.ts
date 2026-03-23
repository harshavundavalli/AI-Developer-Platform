import { prisma } from "@/lib/db";
import { storeEmbeddingBatch, createVectorIndex } from "@/lib/db/vectors";
import { llm } from "@/lib/llm";
import { fetchRepoTree, fetchFileContent } from "./github";
import { chunkCode, shouldProcessFile } from "./chunker";
import type { CodeChunkData } from "@/types";

const EMBEDDING_BATCH_SIZE = 50;

interface IngestionCallbacks {
  onProgress?: (phase: string, progress: number, total: number) => void;
  onError?: (error: string) => void;
}

/**
 * Full ingestion pipeline for a repository.
 * Fetches files via GitHub API, chunks them, generates embeddings, and stores everything.
 */
export async function ingestRepository(
  repoId: string,
  accessToken: string,
  callbacks?: IngestionCallbacks
): Promise<void> {
  const repo = await prisma.repository.findUnique({ where: { id: repoId } });
  if (!repo) throw new Error("Repository not found");

  // Update status
  await prisma.repository.update({
    where: { id: repoId },
    data: { status: "INGESTING" },
  });

  try {
    // ─── Phase 1: Fetch file tree ───
    callbacks?.onProgress?.("Fetching file tree", 0, 1);

    const tree = await fetchRepoTree(
      accessToken,
      repo.owner,
      repo.name,
      repo.defaultBranch
    );

    const processableFiles = tree.filter((f) =>
      shouldProcessFile(f.path, f.size)
    );

    callbacks?.onProgress?.("Fetching file tree", 1, 1);

    // ─── Phase 2: Fetch & chunk files ───
    const allChunks: CodeChunkData[] = [];
    let filesProcessed = 0;

    for (const file of processableFiles) {
      try {
        const content = await fetchFileContent(
          accessToken,
          repo.owner,
          repo.name,
          file.path,
          repo.defaultBranch
        );

        const chunks = chunkCode(content, file.path);
        allChunks.push(...chunks);
      } catch (err) {
        console.warn(`Skipping ${file.path}: ${err}`);
      }

      filesProcessed++;
      if (filesProcessed % 10 === 0) {
        callbacks?.onProgress?.(
          "Processing files",
          filesProcessed,
          processableFiles.length
        );
      }
    }

    callbacks?.onProgress?.(
      "Processing files",
      processableFiles.length,
      processableFiles.length
    );

    // ─── Phase 3: Clear old data ───
    await prisma.codeChunk.deleteMany({ where: { repoId } });

    // ─── Phase 4: Store chunks ───
    callbacks?.onProgress?.("Storing chunks", 0, allChunks.length);

    const storedChunks = await prisma.codeChunk.createManyAndReturn({
      data: allChunks.map((chunk) => ({
        repoId,
        filePath: chunk.filePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        chunkType: chunk.chunkType as any,
        content: chunk.content,
        language: chunk.language,
      })),
    });

    callbacks?.onProgress?.("Storing chunks", allChunks.length, allChunks.length);

    // ─── Phase 5: Generate & store embeddings ───
    let embeddingsGenerated = 0;

    for (let i = 0; i < storedChunks.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = storedChunks.slice(i, i + EMBEDDING_BATCH_SIZE);
      const texts = batch.map(
        (c) => `File: ${c.filePath}\n\n${c.content}`
      );

      try {
        const embeddings = await llm.generateEmbeddingBatch(texts);

        await storeEmbeddingBatch(
          batch.map((chunk, idx) => ({
            chunkId: chunk.id,
            embedding: embeddings[idx],
          }))
        );

        embeddingsGenerated += batch.length;
        callbacks?.onProgress?.(
          "Generating embeddings",
          embeddingsGenerated,
          storedChunks.length
        );
      } catch (err) {
        console.error(`Embedding batch error at index ${i}:`, err);
        // Wait and retry once on rate limit
        await new Promise((r) => setTimeout(r, 5000));
        try {
          const embeddings = await llm.generateEmbeddingBatch(texts);
          await storeEmbeddingBatch(
            batch.map((chunk, idx) => ({
              chunkId: chunk.id,
              embedding: embeddings[idx],
            }))
          );
          embeddingsGenerated += batch.length;
        } catch (retryErr) {
          console.error(`Embedding retry failed:`, retryErr);
          callbacks?.onError?.(
            `Failed to embed batch at index ${i}: ${retryErr}`
          );
        }
      }
    }

    // ─── Phase 6: Create vector index ───
    callbacks?.onProgress?.("Creating search index", 0, 1);
    await createVectorIndex();

    // ─── Phase 7: Update repo stats ───
    await prisma.repository.update({
      where: { id: repoId },
      data: {
        status: "READY",
        totalChunks: storedChunks.length,
        totalFiles: processableFiles.length,
        lastSyncedAt: new Date(),
      },
    });

    callbacks?.onProgress?.("Complete", 1, 1);
  } catch (err) {
    console.error("Ingestion failed:", err);

    await prisma.repository.update({
      where: { id: repoId },
      data: { status: "ERROR" },
    });

    callbacks?.onError?.(
      err instanceof Error ? err.message : "Unknown error"
    );
    throw err;
  }
}
