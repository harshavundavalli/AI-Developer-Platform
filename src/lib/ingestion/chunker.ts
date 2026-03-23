import type { CodeChunkData } from "@/types";

const SUPPORTED_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".go", ".rs",
  ".rb", ".php", ".c", ".cpp", ".h", ".hpp", ".cs", ".swift",
  ".kt", ".scala", ".vue", ".svelte", ".sql", ".sh", ".bash",
  ".yaml", ".yml", ".json", ".toml", ".xml", ".html", ".css",
  ".scss", ".md", ".txt", ".dockerfile", ".tf",
]);

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build", "out",
  "__pycache__", ".venv", "venv", "vendor", ".idea", ".vscode",
  "coverage", ".nyc_output", ".turbo", ".cache", "target",
]);

const SKIP_FILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
  "composer.lock", "Gemfile.lock", "Cargo.lock",
  "poetry.lock", ".DS_Store", "thumbs.db",
]);

const MAX_FILE_SIZE = 50_000; // 50KB

/**
 * Check if a file should be processed.
 */
export function shouldProcessFile(filePath: string, size?: number): boolean {
  if (size && size > MAX_FILE_SIZE) return false;

  const parts = filePath.split("/");
  const fileName = parts[parts.length - 1];

  if (SKIP_FILES.has(fileName)) return false;
  if (parts.some((p) => SKIP_DIRS.has(p))) return false;
  if (fileName.startsWith(".")) return false;

  const ext = "." + fileName.split(".").pop()?.toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

/**
 * Detect language from file extension.
 */
export function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const langMap: Record<string, string> = {
    js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
    py: "python", java: "java", go: "go", rs: "rust", rb: "ruby",
    php: "php", c: "c", cpp: "cpp", h: "c", hpp: "cpp", cs: "csharp",
    swift: "swift", kt: "kotlin", scala: "scala", vue: "vue",
    svelte: "svelte", sql: "sql", sh: "bash", bash: "bash",
    yaml: "yaml", yml: "yaml", json: "json", toml: "toml",
    xml: "xml", html: "html", css: "css", scss: "scss",
    md: "markdown", txt: "text", dockerfile: "dockerfile", tf: "terraform",
  };
  return langMap[ext] || "text";
}

/**
 * Chunk code using pattern-based splitting.
 * Looks for function/class/interface boundaries.
 */
export function chunkCode(
  content: string,
  filePath: string,
  maxChunkLines: number = 60,
  overlapLines: number = 5
): CodeChunkData[] {
  const language = detectLanguage(filePath);
  const lines = content.split("\n");

  // For small files, treat as single chunk
  if (lines.length <= maxChunkLines) {
    return [{
      filePath,
      startLine: 1,
      endLine: lines.length,
      chunkType: "OTHER",
      content,
      language,
    }];
  }

  const chunks: CodeChunkData[] = [];
  const boundaries = findBoundaries(lines, language);

  if (boundaries.length > 0) {
    // Use semantic boundaries
    for (const boundary of boundaries) {
      chunks.push({
        filePath,
        startLine: boundary.startLine,
        endLine: boundary.endLine,
        chunkType: boundary.type,
        content: lines.slice(boundary.startLine - 1, boundary.endLine).join("\n"),
        language,
      });
    }
  } else {
    // Fallback: sliding window
    for (let i = 0; i < lines.length; i += maxChunkLines - overlapLines) {
      const start = i;
      const end = Math.min(i + maxChunkLines, lines.length);
      chunks.push({
        filePath,
        startLine: start + 1,
        endLine: end,
        chunkType: "BLOCK",
        content: lines.slice(start, end).join("\n"),
        language,
      });
      if (end >= lines.length) break;
    }
  }

  return chunks;
}

interface Boundary {
  startLine: number;
  endLine: number;
  type: "FUNCTION" | "CLASS" | "INTERFACE" | "TYPE" | "IMPORT" | "BLOCK" | "OTHER";
}

/**
 * Find semantic boundaries in code using regex patterns.
 */
function findBoundaries(lines: string[], language: string): Boundary[] {
  const boundaries: Boundary[] = [];

  const patterns: Record<string, Array<{ regex: RegExp; type: Boundary["type"] }>> = {
    javascript: [
      { regex: /^(export\s+)?(async\s+)?function\s+\w+/, type: "FUNCTION" },
      { regex: /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/, type: "FUNCTION" },
      { regex: /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?(\w+\s*)?\s*=>\s*/, type: "FUNCTION" },
      { regex: /^(export\s+)?(default\s+)?class\s+\w+/, type: "CLASS" },
      { regex: /^(export\s+)?interface\s+\w+/, type: "INTERFACE" },
      { regex: /^(export\s+)?type\s+\w+/, type: "TYPE" },
    ],
    typescript: [
      { regex: /^(export\s+)?(async\s+)?function\s+\w+/, type: "FUNCTION" },
      { regex: /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/, type: "FUNCTION" },
      { regex: /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?(\w+\s*)?\s*=>\s*/, type: "FUNCTION" },
      { regex: /^(export\s+)?(default\s+)?(abstract\s+)?class\s+\w+/, type: "CLASS" },
      { regex: /^(export\s+)?interface\s+\w+/, type: "INTERFACE" },
      { regex: /^(export\s+)?type\s+\w+/, type: "TYPE" },
    ],
    python: [
      { regex: /^(async\s+)?def\s+\w+/, type: "FUNCTION" },
      { regex: /^class\s+\w+/, type: "CLASS" },
    ],
    java: [
      { regex: /^\s*(public|private|protected)?\s*(static\s+)?\w+\s+\w+\s*\(/, type: "FUNCTION" },
      { regex: /^\s*(public|private|protected)?\s*(abstract\s+)?class\s+\w+/, type: "CLASS" },
      { regex: /^\s*(public\s+)?interface\s+\w+/, type: "INTERFACE" },
    ],
    go: [
      { regex: /^func\s+(\(\w+\s+\*?\w+\)\s+)?\w+\s*\(/, type: "FUNCTION" },
      { regex: /^type\s+\w+\s+struct/, type: "CLASS" },
      { regex: /^type\s+\w+\s+interface/, type: "INTERFACE" },
    ],
    rust: [
      { regex: /^(pub\s+)?(async\s+)?fn\s+\w+/, type: "FUNCTION" },
      { regex: /^(pub\s+)?struct\s+\w+/, type: "CLASS" },
      { regex: /^(pub\s+)?trait\s+\w+/, type: "INTERFACE" },
      { regex: /^(pub\s+)?impl\s+/, type: "CLASS" },
    ],
  };

  const langPatterns = patterns[language] || patterns.javascript || [];
  let currentStart: number | null = null;
  let currentType: Boundary["type"] = "OTHER";
  let braceDepth = 0;
  let inBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();

    // Check if this line starts a new boundary
    if (!inBlock) {
      for (const { regex, type } of langPatterns) {
        if (regex.test(trimmed)) {
          // Save previous block if any
          if (currentStart !== null) {
            boundaries.push({
              startLine: currentStart + 1,
              endLine: i,
              type: currentType,
            });
          }
          currentStart = i;
          currentType = type;
          braceDepth = 0;
          inBlock = true;
          break;
        }
      }
    }

    // Track braces to find end of block
    if (inBlock) {
      for (const ch of lines[i]) {
        if (ch === "{" || ch === "(") braceDepth++;
        if (ch === "}" || ch === ")") braceDepth--;
      }

      // For Python, use indentation
      if (language === "python" && currentStart !== null && i > currentStart) {
        const currentIndent = lines[i].length - lines[i].trimStart().length;
        const startIndent = lines[currentStart].length - lines[currentStart].trimStart().length;
        if (trimmed.length > 0 && currentIndent <= startIndent && i - currentStart > 1) {
          boundaries.push({
            startLine: currentStart + 1,
            endLine: i,
            type: currentType,
          });
          currentStart = null;
          inBlock = false;
          // Re-check this line
          i--;
          continue;
        }
      }

      // Brace-based languages
      if (language !== "python" && braceDepth <= 0 && i > (currentStart ?? 0)) {
        if (lines[i].includes("}") || lines[i].includes(")")) {
          boundaries.push({
            startLine: (currentStart ?? 0) + 1,
            endLine: i + 1,
            type: currentType,
          });
          currentStart = null;
          inBlock = false;
        }
      }
    }
  }

  // Capture last block
  if (currentStart !== null) {
    boundaries.push({
      startLine: currentStart + 1,
      endLine: lines.length,
      type: currentType,
    });
  }

  // If boundaries don't cover all lines, fill gaps
  if (boundaries.length > 0) {
    const filled: Boundary[] = [];
    let lastEnd = 0;

    for (const b of boundaries) {
      if (b.startLine > lastEnd + 1) {
        filled.push({
          startLine: lastEnd + 1,
          endLine: b.startLine - 1,
          type: "OTHER",
        });
      }
      filled.push(b);
      lastEnd = b.endLine;
    }

    if (lastEnd < lines.length) {
      filled.push({
        startLine: lastEnd + 1,
        endLine: lines.length,
        type: "OTHER",
      });
    }

    // Merge very small chunks (< 3 lines) with neighbors
    return filled.filter(
      (b) => b.endLine - b.startLine >= 2 || b.type !== "OTHER"
    );
  }

  return boundaries;
}
