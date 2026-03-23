import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireAuth();

    const conversations = await prisma.conversation.findMany({
      where: { userId: user.id },
      include: {
        repository: { select: { fullName: true, name: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    const data = conversations.map((c) => ({
      id: c.id,
      title: c.title,
      repoId: c.repoId,
      repoName: c.repository.fullName,
      messageCount: c._count.messages,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("GET /api/conversations error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}
