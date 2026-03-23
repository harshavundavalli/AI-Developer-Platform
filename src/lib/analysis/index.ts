import { llm } from "@/lib/llm";
import { retrieveContext, retrieveFileContext } from "@/lib/retrieval";

/**
 * Repository Q&A — answer a question grounded in codebase context.
 */
export async function* queryRepository(
  query: string,
  repoId: string,
  conversationHistory: Array<{ role: string; content: string }> = []
): AsyncGenerator<string> {
  const { assembledContext, chunks } = await retrieveContext(query, repoId);

  const historyStr = conversationHistory
    .slice(-6) // Last 3 exchanges
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const prompt = historyStr
    ? `Previous conversation:\n${historyStr}\n\nNew question: ${query}`
    : query;

  const systemPrompt = `You are an expert code assistant analyzing a repository. Answer questions based ONLY on the provided codebase context. Always cite specific file paths and line numbers. If the context doesn't contain enough information to answer fully, say so. Use markdown formatting with code blocks.`;

  yield* llm.generateResponse(prompt, assembledContext, { systemPrompt });
}

/**
 * AI Code Review — analyze code for issues and improvements.
 */
export async function* reviewCode(
  code: string,
  filePath: string,
  repoId: string
): AsyncGenerator<string> {
  const { assembledContext } = await retrieveFileContext(filePath, repoId);

  const systemPrompt = `You are a senior code reviewer. Analyze the provided code and give a thorough review.

Structure your review as:
1. **Summary**: Brief overview of what the code does
2. **Issues**: List problems found, each with:
   - Severity: 🔴 Critical, 🟡 Warning, 🔵 Suggestion, ✅ Good
   - Line reference
   - Description and fix
3. **Score**: Rate 1-10

Consider: bugs, security, performance, readability, best practices, and patterns used elsewhere in this repo.`;

  const prompt = `Review this code from ${filePath}:\n\n\`\`\`\n${code}\n\`\`\``;

  yield* llm.generateResponse(prompt, assembledContext, { systemPrompt });
}

/**
 * Bug Explanation — explain an error based on codebase context.
 */
export async function* explainBug(
  errorText: string,
  repoId: string
): AsyncGenerator<string> {
  // Extract file references from the error/stack trace
  const fileRefs = extractFileReferences(errorText);
  const query = `error in ${fileRefs.join(", ")}: ${errorText.slice(0, 500)}`;
  const { assembledContext } = await retrieveContext(query, repoId, 15);

  const systemPrompt = `You are a debugging expert. Analyze the error/stack trace and explain:

1. **What happened**: Plain-English explanation of the error
2. **Root cause**: Why this error occurred, referencing specific code
3. **How to fix**: Step-by-step fix with code examples
4. **Related files**: Other files that might be affected

Use the codebase context to give specific, actionable advice.`;

  yield* llm.generateResponse(errorText, assembledContext, { systemPrompt });
}

/**
 * Documentation Generation — generate docs for code.
 */
export async function* generateDocs(
  code: string,
  filePath: string,
  repoId: string,
  level: "function" | "file" | "project" = "file"
): AsyncGenerator<string> {
  const { assembledContext } = await retrieveFileContext(filePath, repoId);

  const levelPrompts: Record<string, string> = {
    function: `Generate comprehensive JSDoc/docstring documentation for each function in this code. Include:
- Description
- @param with types and descriptions
- @returns with type and description
- @throws if applicable
- @example with usage example`,

    file: `Generate a file-level documentation header for this module. Include:
- Module description and purpose
- Key exports and their roles
- Dependencies and relationships to other modules
- Usage examples`,

    project: `Based on this code and the broader codebase context, generate a comprehensive README.md section. Include:
- Overview of what this part of the project does
- Architecture and key components
- Setup and usage instructions
- API reference for public interfaces`,
  };

  const systemPrompt = `You are a technical writer creating clear, comprehensive documentation. ${levelPrompts[level]}

Output in markdown format ready to be used directly.`;

  const prompt = `Generate ${level}-level documentation for ${filePath}:\n\n\`\`\`\n${code}\n\`\`\``;

  yield* llm.generateResponse(prompt, assembledContext, { systemPrompt });
}

/**
 * Extract file paths from error text / stack traces.
 */
function extractFileReferences(text: string): string[] {
  const patterns = [
    /(?:at\s+.+\s+\(?)([^\s():]+\.\w+):(\d+)/g,     // JS stack traces
    /File "([^"]+)", line (\d+)/g,                      // Python
    /([a-zA-Z0-9_/.-]+\.\w+):(\d+)/g,                  // Generic file:line
  ];

  const files = new Set<string>();
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const filePath = match[1];
      if (!filePath.includes("node_modules") && !filePath.startsWith("internal/")) {
        files.add(filePath);
      }
    }
  }
  return Array.from(files).slice(0, 5);
}
