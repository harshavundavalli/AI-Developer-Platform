import prisma from "./prisma";

/**
 * Store an embedding vector for a code chunk.
 * Uses raw SQL because Prisma doesn't natively support pgvector types.
 */
export async function storeEmbedding(
  chunkId: string,
  embedding: number[],
  modelVersion: string = "text-embedding-004"
) {
  const vectorStr = `[${embedding.join(",")}]`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Embedding" (id, "chunkId", embedding, "modelVersion", "createdAt")
     VALUES (gen_random_uuid(), $1, $2::vector, $3, NOW())
     ON CONFLICT ("chunkId") DO UPDATE SET embedding = $2::vector, "modelVersion" = $3`,
    chunkId,
    vectorStr,
    modelVersion
  );
}

/**
 * Store multiple embeddings in a single transaction.
 */
export async function storeEmbeddingBatch(
  items: Array<{ chunkId: string; embedding: number[] }>,
  modelVersion: string = "text-embedding-004"
) {
  const queries = items.map((item) => {
    const vectorStr = `[${item.embedding.join(",")}]`;
    return prisma.$executeRawUnsafe(
      `INSERT INTO "Embedding" (id, "chunkId", embedding, "modelVersion", "createdAt")
       VALUES (gen_random_uuid(), $1, $2::vector, $3, NOW())
       ON CONFLICT ("chunkId") DO UPDATE SET embedding = $2::vector, "modelVersion" = $3`,
      item.chunkId,
      vectorStr,
      modelVersion
    );
  });
  await prisma.$transaction(queries);
}

/**
 * Find the most similar code chunks to a query vector using cosine distance.
 */
export async function findSimilarChunks(
  queryEmbedding: number[],
  repoId: string,
  limit: number = 10,
  threshold: number = 0.8
): Promise<
  Array<{
    chunkId: string;
    filePath: string;
    content: string;
    language: string;
    startLine: number;
    endLine: number;
    chunkType: string;
    similarity: number;
  }>
> {
  const vectorStr = `[${queryEmbedding.join(",")}]`;
  const results = await prisma.$queryRawUnsafe<
    Array<{
      chunkId: string;
      filePath: string;
      content: string;
      language: string;
      startLine: number;
      endLine: number;
      chunkType: string;
      similarity: number;
    }>
  >(
    `SELECT
       e."chunkId" as "chunkId",
       c."filePath" as "filePath",
       c.content,
       c.language,
       c."startLine" as "startLine",
       c."endLine" as "endLine",
       c."chunkType" as "chunkType",
       1 - (e.embedding <=> $1::vector) as similarity
     FROM "Embedding" e
     JOIN "CodeChunk" c ON c.id = e."chunkId"
     WHERE c."repoId" = $2
       AND 1 - (e.embedding <=> $1::vector) > $3
     ORDER BY e.embedding <=> $1::vector
     LIMIT $4`,
    vectorStr,
    repoId,
    threshold,
    limit
  );
  return results;
}

/**
 * Create the IVFFlat index for fast similarity search.
 * Call after bulk-inserting embeddings for a repo.
 */
export async function createVectorIndex() {
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS embedding_vector_idx
     ON "Embedding" USING ivfflat (embedding vector_cosine_ops)
     WITH (lists = 100)`
  );
}

/**
 * Get repo embedding stats.
 */
export async function getRepoEmbeddingCount(repoId: string): Promise<number> {
  const result = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM "Embedding" e
     JOIN "CodeChunk" c ON c.id = e."chunkId"
     WHERE c."repoId" = $1`,
    repoId
  );
  return Number(result[0]?.count ?? 0);
}
