export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const user = await requireAuth();

    const job = await prisma.job.findUnique({
      where: { id: params.jobId },
      include: { repository: { select: { userId: true } } },
    });

    if (!job || job.repository.userId !== user.id) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const meta = job.metadata as { phase?: string } | null;

    return NextResponse.json({
      success: true,
      data: {
        status: job.status,
        phase: meta?.phase ?? null,
        progress: job.progress,
        total: job.total,
        error: job.error,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
