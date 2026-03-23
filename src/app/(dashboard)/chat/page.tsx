"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";

interface Conversation {
  id: string;
  title: string;
  repoId: string;
  repoName: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((d) => d.success && setConversations(d.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Conversations</h1>
        <p className="mt-1 text-surface-400">Your chat history with repositories.</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl animate-shimmer" />
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">💬</div>
          <p className="text-surface-400">No conversations yet.</p>
          <Link
            href="/repos"
            className="mt-4 inline-block px-4 py-2 bg-blue-500/10 text-blue-400 rounded-lg text-sm hover:bg-blue-500/20 transition-colors"
          >
            Go to Repositories
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className="glass rounded-xl p-4 flex items-center justify-between group hover:border-surface-600 transition-colors"
            >
              <Link href={`/chat/${conv.repoId}?conversation=${conv.id}`} className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate group-hover:text-blue-400 transition-colors">
                  {conv.title}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-surface-500">
                  <span>{conv.repoName}</span>
                  <span>·</span>
                  <span>{conv.messageCount} messages</span>
                  <span>·</span>
                  <span>{formatRelativeTime(conv.updatedAt)}</span>
                </div>
              </Link>
              <button
                onClick={() => handleDelete(conv.id)}
                className="p-2 text-surface-600 hover:text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
