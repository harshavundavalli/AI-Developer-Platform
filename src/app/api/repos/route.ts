import { NextResponse } from "next/server";
import { requireAuth, getGitHubToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchUserRepos } from "@/lib/ingestion";

export async function GET() {
  try {
    const user = await requireAuth();
    const token = await getGitHubToken(user.id);

    if (!token) {
      return NextResponse.json(
        { success: false, error: "GitHub token not found. Please re-authenticate." },
        { status: 401 }
      );
    }

    // Fetch repos from GitHub
    const githubRepos = await fetchUserRepos(token);

    // Get tracked repos from our DB
    const trackedRepos = await prisma.repository.findMany({
      where: { userId: user.id },
      select: { githubRepoId: true, status: true, totalChunks: true, totalFiles: true, lastSyncedAt: true, id: true },
    });

    const trackedMap = new Map(
      trackedRepos.map((r) => [r.githubRepoId, r])
    );

    // Merge GitHub data with our tracking data
    const repos = githubRepos.map((repo) => {
      const tracked = trackedMap.get(repo.id);
      return {
        githubId: repo.id,
        id: tracked?.id || null,
        fullName: repo.full_name,
        name: repo.name,
        owner: repo.owner.login,
        ownerAvatar: repo.owner.avatar_url,
        description: repo.description,
        defaultBranch: repo.default_branch,
        language: repo.language,
        stars: repo.stargazers_count,
        isPrivate: repo.private,
        htmlUrl: repo.html_url,
        updatedAt: repo.updated_at,
        // Tracking data
        status: tracked?.status || null,
        totalChunks: tracked?.totalChunks || 0,
        totalFiles: tracked?.totalFiles || 0,
        lastSyncedAt: tracked?.lastSyncedAt?.toISOString() || null,
      };
    });

    return NextResponse.json({ success: true, data: repos });
  } catch (err) {
    console.error("GET /api/repos error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch repositories" },
      { status: 500 }
    );
  }
}
