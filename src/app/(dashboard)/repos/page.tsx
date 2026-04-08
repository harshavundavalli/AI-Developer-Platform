"use client";

import { useState, useEffect } from "react";
import { RepoCard } from "@/components/repos/repo-card";

interface Repo {
  githubId: number;
  id: string | null;
  fullName: string;
  name: string;
  owner: string;
  ownerAvatar: string;
  description: string | null;
  defaultBranch: string;
  language: string | null;
  stars: number;
  isPrivate: boolean;
  htmlUrl: string;
  updatedAt: string;
  status: string | null;
  totalChunks: number;
  totalFiles: number;
  lastSyncedAt: string | null;
}

export default function ReposPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "ingested" | "pending">("all");
  const [jobIds, setJobIds] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchRepos();
  }, []);

  async function fetchRepos() {
    try {
      const res = await fetch("/api/repos");
      const data = await res.json();
      if (data.success) {
        setRepos(data.data);
      } else {
        setError(data.error);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleIngest(repo: Repo) {
    try {
      const res = await fetch(`/api/repos/${repo.githubId}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubRepoId: repo.githubId,
          fullName: repo.fullName,
          name: repo.name,
          owner: repo.owner,
          description: repo.description,
          defaultBranch: repo.defaultBranch,
          language: repo.language,
          stars: repo.stars,
          isPrivate: repo.isPrivate,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRepos((prev) =>
          prev.map((r) =>
            r.githubId === repo.githubId
              ? { ...r, id: data.data.repoId, status: "INGESTING" }
              : r
          )
        );
        setJobIds((prev) => ({ ...prev, [repo.githubId]: data.data.jobId }));
      }
    } catch {
      console.error("Failed to start ingestion");
    }
  }

  const filtered = repos.filter((r) => {
    const matchesSearch =
      r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "ingested" && r.status === "READY") ||
      (filter === "pending" && !r.status);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Repositories</h1>
        <p className="mt-1 text-surface-400">
          Connect a repository to start analyzing it with AI.
        </p>
      </div>

      {/* Search & filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500"
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search repositories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface-900/50 border border-surface-700 rounded-lg text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 placeholder:text-surface-500"
          />
        </div>
        <div className="flex gap-1 p-1 bg-surface-900/50 border border-surface-700 rounded-lg">
          {(["all", "ingested", "pending"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                filter === f
                  ? "bg-blue-500/15 text-blue-400"
                  : "text-surface-400 hover:text-surface-200"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-xl animate-shimmer" />
          ))}
        </div>
      ) : error ? (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchRepos}
            className="mt-4 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-lg text-sm hover:bg-blue-500/20 transition-colors"
          >
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">📂</div>
          <p className="text-surface-400">
            {search ? "No repositories match your search." : "No repositories found."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((repo) => (
            <RepoCard
              key={repo.githubId}
              repo={repo}
              jobId={jobIds[repo.githubId] ?? null}
              onIngest={() => handleIngest(repo)}
              onIngestionComplete={fetchRepos}
            />
          ))}
        </div>
      )}
    </div>
  );
}
