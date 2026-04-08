"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn, formatRelativeTime, getLanguageColor } from "@/lib/utils";

interface JobProgress {
  status: string;
  phase: string | null;
  progress: number;
  total: number;
  error: string | null;
}

interface RepoCardProps {
  repo: {
    githubId: number;
    id: string | null;
    fullName: string;
    name: string;
    owner: string;
    description: string | null;
    language: string | null;
    stars: number;
    isPrivate: boolean;
    updatedAt: string;
    status: string | null;
    totalChunks: number;
    totalFiles: number;
  };
  jobId: string | null;
  onIngest: () => void;
  onIngestionComplete?: () => void;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  READY: { label: "Ready", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  INGESTING: { label: "Ingesting...", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  ERROR: { label: "Error", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  PENDING: { label: "Pending", color: "text-surface-400", bg: "bg-surface-500/10 border-surface-500/20" },
  STALE: { label: "Stale", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
};

export function RepoCard({ repo, jobId, onIngest, onIngestionComplete }: RepoCardProps) {
  const status = repo.status ? statusConfig[repo.status] : null;
  const [jobProgress, setJobProgress] = useState<JobProgress | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId || repo.status !== "INGESTING") {
      setJobProgress(null);
      return;
    }

    async function poll() {
      const res = await fetch(`/api/jobs/${jobId}`).catch(() => null);
      if (!res?.ok) return;
      const data = await res.json();
      if (!data.success) return;

      setJobProgress(data.data);

      if (data.data.status === "COMPLETED" || data.data.status === "FAILED") {
        if (intervalRef.current) clearInterval(intervalRef.current);
        onIngestionComplete?.();
      }
    }

    poll();
    intervalRef.current = setInterval(poll, 2000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, repo.status]);

  const pct = jobProgress && jobProgress.total > 0
    ? Math.round((jobProgress.progress / jobProgress.total) * 100)
    : null;

  return (
    <div className="glass rounded-xl p-5 hover:border-surface-600 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate group-hover:text-blue-400 transition-colors">
              {repo.fullName}
            </h3>
            {repo.isPrivate && (
              <span className="px-1.5 py-0.5 text-[10px] border border-surface-600 rounded text-surface-400">
                Private
              </span>
            )}
          </div>
          {repo.description && (
            <p className="mt-1 text-xs text-surface-400 line-clamp-2">
              {repo.description}
            </p>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-4 text-xs text-surface-500 mb-4">
        {repo.language && (
          <div className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: getLanguageColor(repo.language) }}
            />
            {repo.language}
          </div>
        )}
        {repo.stars > 0 && (
          <div className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-amber-400">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {repo.stars.toLocaleString()}
          </div>
        )}
        <span>{formatRelativeTime(repo.updatedAt)}</span>
      </div>

      {/* Progress bar (shown while ingesting with a jobId) */}
      {repo.status === "INGESTING" && jobProgress && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-amber-400">{jobProgress.phase ?? "Starting..."}</span>
            {pct !== null && (
              <span className="text-xs text-surface-500">{pct}%</span>
            )}
          </div>
          <div className="h-1.5 w-full bg-surface-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-500"
              style={{ width: pct !== null ? `${pct}%` : "0%" }}
            />
          </div>
          {jobProgress.total > 0 && (
            <p className="mt-1 text-[10px] text-surface-600">
              {jobProgress.progress} / {jobProgress.total}
            </p>
          )}
        </div>
      )}

      {/* MCP banner — shown when repo just finished ingesting this session */}
      {repo.status === "READY" && jobId && (
        <div className="mb-4 flex items-center justify-between gap-3 px-3 py-2.5 bg-purple-500/10 border border-purple-500/20 rounded-lg">
          <div className="flex items-center gap-2 min-w-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400 flex-shrink-0">
              <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
            </svg>
            <span className="text-xs text-purple-300 truncate">
              Query this repo from your editor via MCP
            </span>
          </div>
          <Link
            href="/connect"
            className="text-xs font-medium text-purple-400 hover:text-purple-300 whitespace-nowrap transition-colors"
          >
            Set up →
          </Link>
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center justify-between">
        {status ? (
          <div className="flex items-center gap-3">
            <span className={cn("px-2.5 py-1 text-xs font-medium rounded-md border", status.bg, status.color)}>
              {repo.status === "INGESTING" && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 animate-pulse" />
              )}
              {status.label}
            </span>
            {repo.status === "READY" && (
              <span className="text-xs text-surface-500">
                {repo.totalFiles} files · {repo.totalChunks} chunks
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-surface-500">Not connected</span>
        )}

        <div className="flex gap-2">
          {repo.status === "READY" && repo.id && (
            <Link
              href={`/chat/${repo.id}`}
              className="px-3 py-1.5 text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors"
            >
              Chat
            </Link>
          )}
          {repo.status === "READY" && (
            <button
              onClick={onIngest}
              className="px-3 py-1.5 text-xs font-medium bg-surface-700/50 text-surface-400 border border-surface-600 rounded-lg hover:bg-surface-700 transition-colors"
            >
              Re-index
            </button>
          )}
          {(!repo.status || repo.status === "ERROR" || repo.status === "STALE") && (
            <button
              onClick={onIngest}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors"
            >
              {repo.status === "ERROR" ? "Retry" : "Ingest"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
