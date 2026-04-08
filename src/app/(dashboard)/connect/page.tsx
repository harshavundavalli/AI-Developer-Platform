"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function ConnectPage() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<"key" | "config" | null>(null);

  useEffect(() => {
    fetch("/api/user/api-key")
      .then((r) => r.json())
      .then((d) => setApiKey(d.apiKey))
      .finally(() => setLoading(false));
  }, []);

  async function generateKey() {
    setGenerating(true);
    const res = await fetch("/api/user/api-key", { method: "POST" });
    const data = await res.json();
    setApiKey(data.apiKey);
    setGenerating(false);
  }

  function copy(text: string, type: "key" | "config") {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";
  const mcpConfig = apiKey
    ? JSON.stringify(
        {
          mcpServers: {
            "ai-dev-platform": {
              url: `${origin}/api/mcp`,
              headers: { Authorization: `Bearer ${apiKey}` },
            },
          },
        },
        null,
        2
      )
    : null;

  const tools = [
    { name: "list_repos", desc: "List all your indexed repositories" },
    { name: "query_repo", desc: "Ask any question about a codebase in plain English" },
    { name: "review_code", desc: "Get AI code review grounded in your actual repo" },
    { name: "explain_bug", desc: "Paste an error or stack trace and get an explanation" },
    { name: "generate_docs", desc: "Generate documentation for any piece of code" },
  ];

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Connect via MCP</h1>
        <p className="mt-1 text-surface-400">
          Use your indexed repos directly inside Claude Code — no browser needed.
        </p>
      </div>

      {/* What is MCP */}
      <div className="glass rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">
          What is MCP?
        </h2>
        <p className="text-sm text-surface-400 leading-relaxed">
          MCP (Model Context Protocol) lets AI assistants like Claude Code call external tools.
          Once connected, Claude can query your indexed codebase, run code reviews, explain bugs,
          and generate docs — all from inside your editor, grounded in your actual code.
        </p>
      </div>

      {/* Step 1 — Get API key */}
      <div className="glass rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
          <h2 className="text-sm font-semibold text-surface-200">Generate your API key</h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 font-mono text-xs bg-surface-900 border border-surface-700 rounded-lg px-3 py-2.5 text-surface-300 truncate">
            {loading ? "Loading..." : apiKey ?? "No API key yet"}
          </div>
          {apiKey && (
            <button
              onClick={() => copy(apiKey, "key")}
              className="px-3 py-2.5 text-xs bg-surface-800 border border-surface-700 rounded-lg hover:border-surface-600 transition-colors whitespace-nowrap"
            >
              {copied === "key" ? "Copied!" : "Copy"}
            </button>
          )}
          <button
            onClick={generateKey}
            disabled={generating}
            className="px-3 py-2.5 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors whitespace-nowrap disabled:opacity-50"
          >
            {generating ? "Generating..." : apiKey ? "Regenerate" : "Generate key"}
          </button>
        </div>

        {apiKey && (
          <p className="mt-2 text-xs text-surface-600">
            Keep this private. Regenerating will invalidate the old key.
          </p>
        )}
      </div>

      {/* Step 2 — Add config */}
      <div className="glass rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
          <h2 className="text-sm font-semibold text-surface-200">Add to Claude Code config</h2>
        </div>

        {apiKey ? (
          <>
            <p className="text-xs text-surface-500 mb-2">
              Add this to{" "}
              <span className="font-mono text-surface-400">~/.claude/claude_code_config.json</span>:
            </p>
            <div className="relative">
              <pre className="text-xs bg-surface-900 border border-surface-700 rounded-lg p-4 overflow-x-auto text-surface-300">
                {mcpConfig}
              </pre>
              <button
                onClick={() => copy(mcpConfig!, "config")}
                className="absolute top-2 right-2 px-2.5 py-1.5 text-xs bg-surface-800 border border-surface-700 rounded-md hover:border-surface-600 transition-colors"
              >
                {copied === "config" ? "Copied!" : "Copy"}
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-surface-500">Generate an API key first.</p>
        )}
      </div>

      {/* Step 3 — Ingest a repo */}
      <div className="glass rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
          <h2 className="text-sm font-semibold text-surface-200">Ingest a repository</h2>
        </div>
        <p className="text-sm text-surface-400 mb-3">
          The MCP tools work on repos you have indexed. Go to Repositories, click Ingest on any repo, and wait for it to turn Ready.
        </p>
        <Link
          href="/repos"
          className="inline-block px-4 py-2 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors"
        >
          Go to Repositories →
        </Link>
      </div>

      {/* Available tools */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-4">
          Available Tools
        </h2>
        <div className="space-y-3">
          {tools.map((tool) => (
            <div key={tool.name} className="flex items-start gap-3">
              <span className="font-mono text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-1 rounded mt-0.5 whitespace-nowrap">
                {tool.name}
              </span>
              <span className="text-sm text-surface-400">{tool.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
