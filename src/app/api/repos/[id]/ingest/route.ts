import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getGitHubToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ingestRepository } from "@/lib/ingestion";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const token = await getGitHubToken(user.id);

    if (!token) {
      return NextResponse.json(
        { success: false, error: "GitHub token not found" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { githubRepoId, fullName, name, owner, description, defaultBranch, language, stars, isPrivate } = body;

    // Create or update the repository record
    const repo = await prisma.repository.upsert({
      where: {
        userId_githubRepoId: {
          userId: user.id,
          githubRepoId: githubRepoId,
        },
      },
      update: {
        status: "INGESTING",
        description,
        language,
        stars,
      },
      create: {
        userId: user.id,
        githubRepoId,
        fullName,
        name,
        owner,
        description,
        defaultBranch: defaultBranch || "main",
        language,
        stars: stars || 0,
        isPrivate: isPrivate || false,
        status: "INGESTING",
      },
    });

    // Create a job record
    const job = await prisma.job.create({
      data: {
        repoId: repo.id,
        type: "FULL_INGESTION",
        status: "RUNNING",
        startedAt: new Date(),
      },
    });

    // Run ingestion (in production, this would be a background job)
    // For now, we run it async and return immediately
    ingestRepository(repo.id, token, {
      onProgress: async (phase, progress, total) => {
        await prisma.job.update({
          where: { id: job.id },
          data: { progress, total, metadata: { phase } },
        }).catch(() => {});
      },
      onError: async (error) => {
        await prisma.job.update({
          where: { id: job.id },
          data: { status: "FAILED", error, completedAt: new Date() },
        }).catch(() => {});
      },
    })
      .then(async () => {
        await prisma.job.update({
          where: { id: job.id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
      })
      .catch((err) => {
        console.error("Ingestion background error:", err);
      });

    return NextResponse.json({
      success: true,
      data: { repoId: repo.id, jobId: job.id },
    });
  } catch (err) {
    console.error("POST /api/repos/[id]/ingest error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to start ingestion" },
      { status: 500 }
    );
  }
}
