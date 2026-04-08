import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await requireAuth();
  const record = await prisma.user.findUnique({
    where: { id: session.id },
    select: { apiKey: true },
  });
  return NextResponse.json({ apiKey: record?.apiKey ?? null });
}

export async function POST() {
  const session = await requireAuth();
  const apiKey = `adp_${randomUUID().replace(/-/g, "")}`;
  await prisma.user.update({
    where: { id: session.id },
    data: { apiKey },
  });
  return NextResponse.json({ apiKey });
}
