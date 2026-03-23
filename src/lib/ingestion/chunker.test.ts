import { describe, it, expect } from "vitest";
import { chunkCode, shouldProcessFile, detectLanguage } from "@/lib/ingestion/chunker";

describe("shouldProcessFile", () => {
  it("accepts supported extensions", () => {
    expect(shouldProcessFile("src/index.ts")).toBe(true);
    expect(shouldProcessFile("lib/utils.py")).toBe(true);
    expect(shouldProcessFile("main.go")).toBe(true);
  });

  it("rejects unsupported files", () => {
    expect(shouldProcessFile("image.png")).toBe(false);
    expect(shouldProcessFile("data.bin")).toBe(false);
    expect(shouldProcessFile(".env")).toBe(false);
  });

  it("rejects files in skip directories", () => {
    expect(shouldProcessFile("node_modules/pkg/index.js")).toBe(false);
    expect(shouldProcessFile(".git/config")).toBe(false);
    expect(shouldProcessFile("dist/bundle.js")).toBe(false);
  });

  it("rejects lock files", () => {
    expect(shouldProcessFile("package-lock.json")).toBe(false);
    expect(shouldProcessFile("yarn.lock")).toBe(false);
  });

  it("rejects files over size limit", () => {
    expect(shouldProcessFile("big.ts", 100_000)).toBe(false);
    expect(shouldProcessFile("small.ts", 1000)).toBe(true);
  });
});

describe("detectLanguage", () => {
  it("detects common languages", () => {
    expect(detectLanguage("app.ts")).toBe("typescript");
    expect(detectLanguage("app.tsx")).toBe("typescript");
    expect(detectLanguage("main.py")).toBe("python");
    expect(detectLanguage("Main.java")).toBe("java");
    expect(detectLanguage("main.go")).toBe("go");
    expect(detectLanguage("lib.rs")).toBe("rust");
  });

  it("returns text for unknown extensions", () => {
    expect(detectLanguage("file.xyz")).toBe("text");
  });
});

describe("chunkCode", () => {
  it("returns single chunk for small files", () => {
    const code = 'const x = 1;\nconst y = 2;\nconsole.log(x + y);';
    const chunks = chunkCode(code, "small.ts");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].filePath).toBe("small.ts");
    expect(chunks[0].language).toBe("typescript");
  });

  it("detects function boundaries in TypeScript", () => {
    const code = Array(100)
      .fill(null)
      .map((_, i) => {
        if (i === 0) return "export function hello() {";
        if (i === 20) return "}";
        if (i === 25) return "export function world() {";
        if (i === 50) return "}";
        return `  const line${i} = ${i};`;
      })
      .join("\n");

    const chunks = chunkCode(code, "funcs.ts");
    expect(chunks.length).toBeGreaterThan(1);

    const funcChunks = chunks.filter((c) => c.chunkType === "FUNCTION");
    expect(funcChunks.length).toBeGreaterThanOrEqual(1);
  });

  it("falls back to sliding window for large files without boundaries", () => {
    const code = Array(200)
      .fill("const x = 1;")
      .join("\n");

    const chunks = chunkCode(code, "data.json", 60, 5);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].chunkType).toBe("BLOCK");
  });
});
