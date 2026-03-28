export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();

    const repo = await prisma.repository.findUnique({
      where: { id: params.id },
      include: {
        jobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: {
          select: {
            codeChunks: true,
            conversations: true,
          },
        },
      },
    });

    if (!repo) {
      return NextResponse.json(
        { success: false, error: "Repository not found" },
        { status: 404 }
      );
    }

    const latestJob = repo.jobs[0] || null;

    return NextResponse.json({
      success: true,
      data: {
        id: repo.id,
        fullName: repo.fullName,
        status: repo.status,
        totalChunks: repo.totalChunks,
        totalFiles: repo.totalFiles,
        lastSyncedAt: repo.lastSyncedAt?.toISOString() || null,
        chunkCount: repo._count.codeChunks,
        conversationCount: repo._count.conversations,
        latestJob: latestJob
          ? {
              id: latestJob.id,
              type: latestJob.type,
              status: latestJob.status,
              progress: latestJob.progress,
              total: latestJob.total,
              error: latestJob.error,
              phase: (latestJob.metadata as any)?.phase || "Unknown",
            }
          : null,
      },
    });
  } catch (err) {
    console.error("GET /api/repos/[id]/status error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch status" },
      { status: 500 }
    );
  }
}
