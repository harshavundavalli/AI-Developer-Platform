/**
 * MCP Server for AI Dev Platform
 *
 * Exposes your RAG pipeline and code analysis as MCP tools.
 * Run with: npm run mcp
 *
 * Required env vars:
 *   MCP_USER_ID — the userId of the account to act as
 *   DATABASE_URL, HUGGINGFACE_API_KEY (same as .env)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { prisma } from "../src/lib/db/index";
import {
  queryRepository,
  reviewCode,
  explainBug,
  generateDocs,
  generateOverview,
} from "../src/lib/analysis/index";

const USER_ID = process.env.MCP_USER_ID;
if (!USER_ID) {
  console.error("MCP_USER_ID env var is required");
  process.exit(1);
}

async function collectStream(gen: AsyncGenerator<string>): Promise<string> {
  let result = "";
  for await (const chunk of gen) {
    result += chunk;
  }
  return result;
}

const server = new Server(
  { name: "ai-dev-platform", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_repos",
      description: "List all repositories indexed and ready for analysis",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "query_repo",
      description:
        "Ask a question about a repository. Answers are grounded in the actual indexed code.",
      inputSchema: {
        type: "object",
        required: ["repoId", "question"],
        properties: {
          repoId: { type: "string", description: "Repository ID from list_repos" },
          question: { type: "string", description: "Question about the codebase" },
        },
      },
    },
    {
      name: "review_code",
      description:
        "AI code review — analyze code for bugs, security issues, and improvements",
      inputSchema: {
        type: "object",
        required: ["repoId", "code"],
        properties: {
          repoId: { type: "string", description: "Repository ID from list_repos" },
          code: { type: "string", description: "Code to review" },
          filePath: {
            type: "string",
            description: "File path for context (e.g. src/api/route.ts)",
          },
        },
      },
    },
    {
      name: "explain_bug",
      description:
        "Explain an error or stack trace using the codebase as context",
      inputSchema: {
        type: "object",
        required: ["repoId", "errorText"],
        properties: {
          repoId: { type: "string", description: "Repository ID from list_repos" },
          errorText: {
            type: "string",
            description: "Error message or stack trace to explain",
          },
        },
      },
    },
    {
      name: "generate_docs",
      description: "Generate documentation for a piece of code",
      inputSchema: {
        type: "object",
        required: ["repoId", "code"],
        properties: {
          repoId: { type: "string", description: "Repository ID from list_repos" },
          code: { type: "string", description: "Code to document" },
          filePath: {
            type: "string",
            description: "File path for context (e.g. src/lib/utils.ts)",
          },
          level: {
            type: "string",
            enum: ["function", "file", "project"],
            description: "Documentation level (default: file)",
          },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "list_repos") {
      const repos = await prisma.repository.findMany({
        where: { userId: USER_ID, status: "READY" },
        select: {
          id: true,
          fullName: true,
          description: true,
          language: true,
          status: true,
          _count: { select: { codeChunks: true } },
        },
        orderBy: { updatedAt: "desc" },
      });

      const text = repos
        .map(
          (r) =>
            `• ${r.fullName} (id: ${r.id})\n  ${r.description || "No description"}\n  Language: ${r.language || "unknown"} · ${r._count.codeChunks} chunks indexed`
        )
        .join("\n\n");

      return {
        content: [
          {
            type: "text",
            text: repos.length === 0 ? "No indexed repositories found." : text,
          },
        ],
      };
    }

    if (name === "query_repo") {
      const { repoId, question } = args as { repoId: string; question: string };
      const repo = await prisma.repository.findFirst({
        where: { id: repoId, userId: USER_ID },
      });
      if (!repo) throw new Error("Repository not found or access denied");
      if (repo.status !== "READY") throw new Error(`Repository is not ready (status: ${repo.status})`);

      const answer = await collectStream(queryRepository(question, repoId));
      return { content: [{ type: "text", text: answer }] };
    }

    if (name === "review_code") {
      const { repoId, code, filePath = "user-input" } = args as {
        repoId: string;
        code: string;
        filePath?: string;
      };
      const repo = await prisma.repository.findFirst({
        where: { id: repoId, userId: USER_ID },
      });
      if (!repo) throw new Error("Repository not found or access denied");

      const review = await collectStream(reviewCode(code, filePath, repoId));
      return { content: [{ type: "text", text: review }] };
    }

    if (name === "explain_bug") {
      const { repoId, errorText } = args as { repoId: string; errorText: string };
      const repo = await prisma.repository.findFirst({
        where: { id: repoId, userId: USER_ID },
      });
      if (!repo) throw new Error("Repository not found or access denied");

      const explanation = await collectStream(explainBug(errorText, repoId));
      return { content: [{ type: "text", text: explanation }] };
    }

    if (name === "generate_docs") {
      const { repoId, code, filePath = "user-input", level = "file" } = args as {
        repoId: string;
        code: string;
        filePath?: string;
        level?: "function" | "file" | "project";
      };
      const repo = await prisma.repository.findFirst({
        where: { id: repoId, userId: USER_ID },
      });
      if (!repo) throw new Error("Repository not found or access denied");

      const docs = await collectStream(generateDocs(code, filePath, repoId, level));
      return { content: [{ type: "text", text: docs }] };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP server running (stdio)");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
