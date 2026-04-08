"use client";

import { useSession } from "next-auth/react";
import Image from "next/image";
import { useState, useEffect } from "react";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

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

  function copyKey() {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const mcpConfig = apiKey
    ? JSON.stringify(
        {
          mcpServers: {
            "ai-dev-platform": {
              url: `${window.location.origin}/api/mcp`,
              headers: { Authorization: `Bearer ${apiKey}` },
            },
          },
        },
        null,
        2
      )
    : null;

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-surface-400">Manage your account and preferences.</p>
      </div>

      {/* Profile */}
      <div className="glass rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-4">
          Profile
        </h2>
        <div className="flex items-center gap-4">
          {session?.user?.image && (
            <Image
              src={session.user.image}
              alt={session.user.name || "User"}
              width={56}
              height={56}
              className="rounded-full"
            />
          )}
          <div>
            <div className="font-semibold">{session?.user?.name}</div>
            <div className="text-sm text-surface-400">{session?.user?.email}</div>
          </div>
        </div>
      </div>

      {/* MCP API Key */}
      <div className="glass rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-1">
          MCP Server
        </h2>
        <p className="text-xs text-surface-500 mb-4">
          Connect your indexed repos to Claude Code or any MCP-compatible AI assistant.
        </p>

        {/* Key display */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 font-mono text-xs bg-surface-900 border border-surface-700 rounded-lg px-3 py-2.5 text-surface-300 truncate">
            {loading ? "Loading..." : apiKey ?? "No API key generated yet"}
          </div>
          {apiKey && (
            <button
              onClick={copyKey}
              className="px-3 py-2.5 text-xs bg-surface-800 border border-surface-700 rounded-lg hover:border-surface-600 transition-colors whitespace-nowrap"
            >
              {copied ? "Copied!" : "Copy key"}
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

        {/* Config snippet */}
        {mcpConfig && (
          <div>
            <p className="text-xs text-surface-500 mb-2">
              Add this to your{" "}
              <span className="font-mono text-surface-400">~/.claude/claude_code_config.json</span>
              :
            </p>
            <pre className="text-xs bg-surface-900 border border-surface-700 rounded-lg p-3 overflow-x-auto text-surface-300">
              {mcpConfig}
            </pre>
          </div>
        )}
      </div>

      {/* API Configuration */}
      <div className="glass rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-4">
          AI Provider
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">HuggingFace Inference API</div>
            <div className="text-xs text-surface-500 mt-0.5">
              Qwen/Qwen2.5-72B-Instruct · sentence-transformers/all-mpnet-base-v2
            </div>
          </div>
          <span className="px-2.5 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">
            Active
          </span>
        </div>
      </div>

      {/* Stack Info */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-4">
          System Info
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            { label: "Frontend", value: "Next.js 14" },
            { label: "Database", value: "PostgreSQL + pgvector" },
            { label: "Hosting", value: "Vercel + Supabase" },
            { label: "LLM", value: "Qwen2.5-72B-Instruct" },
            { label: "Embeddings", value: "all-mpnet-base-v2 (768d)" },
            { label: "Version", value: "0.1.0" },
          ].map((item) => (
            <div key={item.label} className="flex justify-between py-2 border-b border-surface-800">
              <span className="text-surface-400">{item.label}</span>
              <span className="font-mono text-xs">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
