import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    const conversation = await prisma.conversation.findFirst({
      where: { id: params.id, userId: user.id },
      include: {
        repository: { select: { fullName: true, name: true, id: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: conversation.id,
        title: conversation.title,
        repoId: conversation.repoId,
        repoName: conversation.repository.fullName,
        messages: conversation.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    console.error("GET /api/conversations/[id] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch conversation" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    await prisma.conversation.deleteMany({
      where: { id: params.id, userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/conversations/[id] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to delete conversation" },
      { status: 500 }
    );
  }
}
