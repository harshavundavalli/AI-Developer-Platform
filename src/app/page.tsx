import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { LoginButton } from "@/components/ui/login-button";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/repos");

  return (
    <div className="relative min-h-screen overflow-hidden dot-grid">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-3 animate-fade-in">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
              <line x1="12" y1="2" x2="12" y2="22" opacity="0.4" />
            </svg>
          </div>
          <span className="text-xl font-semibold tracking-tight">AI Dev Platform</span>
        </div>

        {/* Hero */}
        <h1
          className="text-5xl sm:text-7xl font-extrabold text-center leading-tight max-w-4xl animate-slide-up"
          style={{ animationDelay: "0.1s", animationFillMode: "both" }}
        >
          Understand your
          <br />
          <span className="text-gradient">entire codebase</span>
        </h1>

        <p
          className="mt-6 text-lg sm:text-xl text-surface-400 text-center max-w-2xl animate-slide-up"
          style={{ animationDelay: "0.25s", animationFillMode: "both" }}
        >
          AI-powered code review, bug explanation, documentation generation, and
          natural-language Q&A — grounded in your actual repository.
        </p>

        {/* Features grid */}
        <div
          className="mt-12 grid grid-cols-2 sm:grid-cols-5 gap-4 max-w-3xl animate-slide-up"
          style={{ animationDelay: "0.4s", animationFillMode: "both" }}
        >
          {[
            { icon: "🔍", label: "Code Review" },
            { icon: "🐛", label: "Bug Explanation" },
            { icon: "📝", label: "Doc Generation" },
            { icon: "💬", label: "Repo Q&A" },
            { icon: "⚡", label: "MCP Server" },
          ].map((f) => (
            <div
              key={f.label}
              className="glass rounded-xl px-4 py-3 text-center hover:border-blue-500/30 transition-colors"
            >
              <div className="text-2xl mb-1">{f.icon}</div>
              <div className="text-sm font-medium text-surface-300">{f.label}</div>
            </div>
          ))}
        </div>

        {/* MCP callout */}
        <div
          className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl animate-slide-up"
          style={{ animationDelay: "0.5s", animationFillMode: "both" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400 flex-shrink-0">
            <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
          </svg>
          <span className="text-sm text-purple-300">
            Also available as an MCP server — query your repos directly from Claude Code
          </span>
        </div>

        {/* CTA */}
        <div
          className="mt-12 animate-slide-up"
          style={{ animationDelay: "0.55s", animationFillMode: "both" }}
        >
          <LoginButton />
        </div>

        <p
          className="mt-4 text-sm text-surface-500 animate-slide-up"
          style={{ animationDelay: "0.65s", animationFillMode: "both" }}
        >
          Free forever — powered by Google Gemini
        </p>

        {/* Tech badges */}
        <div
          className="mt-16 flex flex-wrap justify-center gap-2 animate-slide-up"
          style={{ animationDelay: "0.75s", animationFillMode: "both" }}
        >
          {["Next.js", "PostgreSQL", "pgvector", "Gemini AI", "GitHub API", "Docker"].map(
            (tech) => (
              <span
                key={tech}
                className="px-3 py-1 text-xs font-mono text-surface-400 border border-surface-800 rounded-full"
              >
                {tech}
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
}
