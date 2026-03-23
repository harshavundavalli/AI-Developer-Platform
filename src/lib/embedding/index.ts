import { llm } from "@/lib/llm";
import { storeEmbedding, storeEmbeddingBatch } from "@/lib/db/vectors";

/**
 * Generate and store an embedding for a single text.
 */
export async function embedAndStore(
  chunkId: string,
  text: string
): Promise<number[]> {
  const embedding = await llm.generateEmbedding(text);
  await storeEmbedding(chunkId, embedding);
  return embedding;
}

/**
 * Generate and store embeddings for multiple texts.
 */
export async function embedBatchAndStore(
  items: Array<{ chunkId: string; text: string }>
): Promise<void> {
  const texts = items.map((i) => i.text);
  const embeddings = await llm.generateEmbeddingBatch(texts);

  await storeEmbeddingBatch(
    items.map((item, idx) => ({
      chunkId: item.chunkId,
      embedding: embeddings[idx],
    }))
  );
}

/**
 * Generate an embedding for a query (without storing).
 */
export async function embedQuery(query: string): Promise<number[]> {
  return llm.generateEmbedding(query);
}
