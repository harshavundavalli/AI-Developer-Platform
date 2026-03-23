import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { explainBug } from "@/lib/analysis";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const { errorText } = await req.json();

    if (!errorText) {
      return new Response(
        JSON.stringify({ error: "errorText is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const repo = await prisma.repository.findFirst({
      where: { id: params.id, userId: user.id, status: "READY" },
    });

    if (!repo) {
      return new Response(
        JSON.stringify({ error: "Repository not found or not ready" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of explainBug(errorText, repo.id)) {
            fullResponse += chunk;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
            );
          }

          await prisma.analysisResult.create({
            data: {
              repoId: repo.id,
              type: "BUG_EXPLANATION",
              input: errorText.slice(0, 5000),
              result: fullResponse,
            },
          });

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
          );
          controller.close();
        } catch (err) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: "Explanation failed" })}\n\n`)
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
    console.error("POST /api/repos/[id]/explain error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
