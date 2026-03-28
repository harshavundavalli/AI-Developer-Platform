export const dynamic = 'force-dynamic';
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { queryRepository } from "@/lib/analysis";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const { query, conversationId } = await req.json();

    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const repo = await prisma.repository.findFirst({
      where: { id: params.id, userId: user.id },
    });

    if (!repo) {
      return new Response(JSON.stringify({ error: "Repository not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (repo.status !== "READY") {
      return new Response(
        JSON.stringify({ error: "Repository not yet ingested" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId: user.id },
        include: {
          messages: { orderBy: { createdAt: "asc" }, take: 20 },
        },
      });
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          userId: user.id,
          repoId: repo.id,
          title: query.slice(0, 100),
        },
        include: { messages: true },
      });
    }

    // Save user message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: query,
      },
    });

    // Build conversation history
    const history = conversation.messages.map((m) => ({
      role: m.role.toLowerCase(),
      content: m.content,
    }));

    // Stream response
    const encoder = new TextEncoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = queryRepository(query, repo.id, history);

          for await (const chunk of generator) {
            fullResponse += chunk;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
            );
          }

          // Send conversation ID
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, conversationId: conversation!.id })}\n\n`
            )
          );

          // Save assistant message
          await prisma.message.create({
            data: {
              conversationId: conversation!.id,
              role: "ASSISTANT",
              content: fullResponse,
            },
          });

          controller.close();
        } catch (err) {
          console.error("Stream error:", err);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "Generation failed" })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("POST /api/repos/[id]/query error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
