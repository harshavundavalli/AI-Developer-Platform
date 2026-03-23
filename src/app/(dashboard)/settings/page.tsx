"use client";

import { useSession } from "next-auth/react";
import Image from "next/image";

export default function SettingsPage() {
  const { data: session } = useSession();

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

      {/* API Configuration */}
      <div className="glass rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-4">
          AI Provider
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">Google Gemini (Free Tier)</div>
            <div className="text-xs text-surface-500 mt-0.5">
              15 requests/minute · 1,500 requests/day · gemini-2.0-flash
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
            { label: "Hosting", value: "Vercel + Railway" },
            { label: "LLM", value: "Gemini 2.0 Flash" },
            { label: "Embeddings", value: "text-embedding-004 (768d)" },
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
