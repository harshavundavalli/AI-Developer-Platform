import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  queryRepository,
  reviewCode,
  explainBug,
  generateDocs,
} from "@/lib/analysis/index";

async function collectStream(gen: AsyncGenerator<string>): Promise<string> {
  let result = "";
  for await (const chunk of gen) result += chunk;
  return result;
}

async function getUserFromRequest(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const apiKey = auth.slice(7);
  const user = await prisma.user.findUnique({
    where: { apiKey },
    select: { id: true },
  });
  return user?.id ?? null;
}

function buildServer(userId: string): McpServer {
  const server = new McpServer({
    name: "ai-dev-platform",
    version: "0.1.0",
  });

  server.tool("list_repos", "List all repositories indexed and ready for analysis", {}, async () => {
    const repos = await prisma.repository.findMany({
      where: { userId, status: "READY" },
      select: {
        id: true,
        fullName: true,
        description: true,
        language: true,
        _count: { select: { codeChunks: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const text =
      repos.length === 0
        ? "No indexed repositories found."
        : repos
            .map(
              (r) =>
                `• ${r.fullName} (id: ${r.id})\n  ${r.description || "No description"}\n  Language: ${r.language || "unknown"} · ${r._count.codeChunks} chunks indexed`
            )
            .join("\n\n");

    return { content: [{ type: "text", text }] };
  });

  server.tool(
    "query_repo",
    "Ask a question about a repository. Answers are grounded in the actual indexed code.",
    {
      repoId: z.string().describe("Repository ID from list_repos"),
      question: z.string().describe("Question about the codebase"),
    },
    async ({ repoId, question }) => {
      const repo = await prisma.repository.findFirst({
        where: { id: repoId, userId },
      });
      if (!repo) return { content: [{ type: "text", text: "Error: Repository not found or access denied" }], isError: true };
      if (repo.status !== "READY") return { content: [{ type: "text", text: `Error: Repository is not ready (status: ${repo.status})` }], isError: true };

      const answer = await collectStream(queryRepository(question, repoId));
      return { content: [{ type: "text", text: answer }] };
    }
  );

  server.tool(
    "review_code",
    "AI code review — analyze code for bugs, security issues, and improvements",
    {
      repoId: z.string().describe("Repository ID from list_repos"),
      code: z.string().describe("Code to review"),
      filePath: z.string().optional().describe("File path for context (e.g. src/api/route.ts)"),
    },
    async ({ repoId, code, filePath = "user-input" }) => {
      const repo = await prisma.repository.findFirst({ where: { id: repoId, userId } });
      if (!repo) return { content: [{ type: "text", text: "Error: Repository not found or access denied" }], isError: true };

      const review = await collectStream(reviewCode(code, filePath, repoId));
      return { content: [{ type: "text", text: review }] };
    }
  );

  server.tool(
    "explain_bug",
    "Explain an error or stack trace using the codebase as context",
    {
      repoId: z.string().describe("Repository ID from list_repos"),
      errorText: z.string().describe("Error message or stack trace to explain"),
    },
    async ({ repoId, errorText }) => {
      const repo = await prisma.repository.findFirst({ where: { id: repoId, userId } });
      if (!repo) return { content: [{ type: "text", text: "Error: Repository not found or access denied" }], isError: true };

      const explanation = await collectStream(explainBug(errorText, repoId));
      return { content: [{ type: "text", text: explanation }] };
    }
  );

  server.tool(
    "generate_docs",
    "Generate documentation for a piece of code",
    {
      repoId: z.string().describe("Repository ID from list_repos"),
      code: z.string().describe("Code to document"),
      filePath: z.string().optional().describe("File path for context (e.g. src/lib/utils.ts)"),
      level: z.enum(["function", "file", "project"]).optional().describe("Documentation level (default: file)"),
    },
    async ({ repoId, code, filePath = "user-input", level = "file" }) => {
      const repo = await prisma.repository.findFirst({ where: { id: repoId, userId } });
      if (!repo) return { content: [{ type: "text", text: "Error: Repository not found or access denied" }], isError: true };

      const docs = await collectStream(generateDocs(code, filePath, repoId, level));
      return { content: [{ type: "text", text: docs }] };
    }
  );

  return server;
}

async function handle(req: Request): Promise<Response> {
  const userId = await getUserFromRequest(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });

  const server = buildServer(userId);
  await server.connect(transport);

  return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
