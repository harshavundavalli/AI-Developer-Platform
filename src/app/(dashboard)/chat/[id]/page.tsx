"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
}

export default function ChatPage() {
  const params = useParams();
  const repoId = params.id as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [repoInfo, setRepoInfo] = useState<{ fullName: string; status: string } | null>(null);
  const [mode, setMode] = useState<"chat" | "review" | "explain" | "docs" | "overview">("chat");
  const [overviewGenerated, setOverviewGenerated] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`/api/repos/${repoId}/status`)
      .then((r) => r.json())
      .then((d) => d.success && setRepoInfo(d.data))
      .catch(() => {});
  }, [repoId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleOverview() {
    if (isStreaming) return;
    setIsStreaming(true);
    setOverviewGenerated(true);
    const assistantId = Date.now().toString();
    setMessages([{ id: assistantId, role: "ASSISTANT", content: "" }]);

    try {
      const res = await fetch(`/api/repos/${repoId}/overview`, { method: "POST" });
      if (!res.ok) throw new Error("Request failed");
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No stream");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value, { stream: true }).split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, content: m.content + data.text } : m)
              );
            }
            if (data.error) {
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, content: `⚠️ Error: ${data.error}` } : m)
              );
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => ({ ...m, content: "Sorry, something went wrong. Please try again." }))
      );
    } finally {
      setIsStreaming(false);
    }
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: Message = { id: Date.now().toString(), role: "USER", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantId, role: "ASSISTANT", content: "" }]);

    try {
      const endpoint =
        mode === "review"
          ? `/api/repos/${repoId}/review`
          : mode === "explain"
          ? `/api/repos/${repoId}/explain`
          : mode === "docs"
          ? `/api/repos/${repoId}/docs`
          : `/api/repos/${repoId}/query`;

      const body =
        mode === "review"
          ? { code: text, filePath: "user-input" }
          : mode === "explain"
          ? { errorText: text }
          : mode === "docs"
          ? { code: text, filePath: "user-input", level: "file" }
          : { query: text, conversationId };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Request failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response stream");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + data.text }
                    : m
                )
              );
            }
            if (data.conversationId) {
              setConversationId(data.conversationId);
            }
            if (data.error) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: `⚠️ Error: ${data.error}` }
                    : m
                )
              );
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Sorry, something went wrong. Please try again." }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const placeholders: Record<string, string> = {
    chat: "Ask anything about this repository...",
    review: "Paste code to review...",
    explain: "Paste an error or stack trace...",
    docs: "Paste code to generate documentation...",
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-surface-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">
              {repoInfo?.fullName || "Loading..."}
            </h1>
            <p className="text-xs text-surface-500 mt-0.5">
              {repoInfo?.status === "READY"
                ? "Repository indexed and ready for analysis"
                : "Repository status: " + (repoInfo?.status || "loading")}
            </p>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-1 p-1 bg-surface-900/50 border border-surface-700 rounded-lg">
            {(
              [
                { key: "chat", label: "💬 Chat" },
                { key: "review", label: "🔍 Review" },
                { key: "explain", label: "🐛 Explain" },
                { key: "docs", label: "📝 Docs" },
                { key: "overview", label: "🗺️ Overview" },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  mode === m.key
                    ? "bg-blue-500/15 text-blue-400"
                    : "text-surface-400 hover:text-surface-200"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-surface-700 flex items-center justify-center mb-6">
              <span className="text-3xl">
                {mode === "chat" ? "💬" : mode === "review" ? "🔍" : mode === "explain" ? "🐛" : mode === "docs" ? "📝" : "🗺️"}
              </span>
            </div>
            <h2 className="text-xl font-semibold mb-2">
              {mode === "chat" && "Ask about your codebase"}
              {mode === "review" && "AI Code Review"}
              {mode === "explain" && "Bug Explanation"}
              {mode === "docs" && "Documentation Generator"}
              {mode === "overview" && "Codebase Overview"}
            </h2>
            <p className="text-surface-400 max-w-md text-sm">
              {mode === "chat" && "Ask questions about your repository. Answers are grounded in your actual code."}
              {mode === "review" && "Paste code and get an AI-powered review with severity ratings and fix suggestions."}
              {mode === "explain" && "Paste an error message or stack trace and get a clear explanation with fixes."}
              {mode === "docs" && "Paste code to auto-generate documentation with JSDoc, module overviews, or README sections."}
              {mode === "overview" && "Generate a full explanation of every file, the architecture, data flow, and key patterns in this repository."}
            </p>
            {mode === "overview" && (
              <button
                onClick={handleOverview}
                disabled={isStreaming}
                className="mt-6 px-6 py-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl text-sm font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50"
              >
                🗺️ Generate Codebase Overview
              </button>
            )}
            {/* Starter prompts for chat mode */}
            {mode === "chat" && (
              <div className="mt-6 grid grid-cols-2 gap-2 max-w-lg">
                {[
                  "How is authentication implemented?",
                  "What are the main API endpoints?",
                  "Explain the database schema",
                  "What patterns are used in this codebase?",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      setInput(prompt);
                      inputRef.current?.focus();
                    }}
                    className="text-left px-3 py-2 text-xs text-surface-400 border border-surface-700 rounded-lg hover:border-blue-500/30 hover:text-blue-400 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "max-w-3xl animate-slide-up",
              msg.role === "USER" ? "ml-auto" : ""
            )}
          >
            <div className="flex items-start gap-3">
              {msg.role === "ASSISTANT" && (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                </div>
              )}
              <div
                className={cn(
                  "rounded-xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "USER"
                    ? "bg-blue-500/10 border border-blue-500/20 text-blue-100"
                    : "bg-surface-900/50 border border-surface-700 prose prose-invert prose-sm max-w-none"
                )}
              >
                {msg.role === "ASSISTANT" ? (
                  <ReactMarkdown>{msg.content || "Thinking..."}</ReactMarkdown>
                ) : (
                  <pre className="whitespace-pre-wrap font-sans !bg-transparent !border-none !p-0 !m-0">
                    {msg.content}
                  </pre>
                )}
              </div>
            </div>
          </div>
        ))}

        {isStreaming && (
          <div className="flex items-center gap-2 text-xs text-surface-500">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Generating response...
          </div>
        )}

        {mode === "overview" && overviewGenerated && !isStreaming && (
          <div className="flex justify-center">
            <button
              onClick={() => { setMessages([]); setOverviewGenerated(false); }}
              className="px-4 py-2 text-xs text-surface-400 border border-surface-700 rounded-lg hover:border-surface-500 hover:text-surface-200 transition-colors"
            >
              ↺ Regenerate Overview
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input — hidden in overview mode */}
      <div className={cn("flex-shrink-0 border-t border-surface-800 p-4", mode === "overview" && "hidden")}>
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholders[mode]}
              rows={mode === "chat" ? 1 : 4}
              className="w-full resize-none bg-surface-900/50 border border-surface-700 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 placeholder:text-surface-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="absolute right-2 bottom-2 p-2 rounded-lg bg-blue-500 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-[10px] text-surface-600 text-center">
            Powered by Google Gemini · Responses grounded in your repository code
          </p>
        </form>
      </div>
    </div>
  );
}
