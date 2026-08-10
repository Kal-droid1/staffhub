import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "ACTIVE";
  const participantId = searchParams.get("participantId");

  const campaigns = await prisma.checklistCampaign.findMany({
    where: {
      status: status as "ACTIVE" | "ARCHIVED",
      OR: [
        { visibility: "ALL_STAFF" },
        { visibility: "CREATOR_ONLY", createdById: userId },
      ],
    },
    select: {
      id: true,
      name: true,
      visibility: true,
      status: true,
      createdById: true,
      createdBy: { select: { name: true } },
      createdAt: true,
      archivedAt: true,
      archivedBy: { select: { name: true } },
      ...(participantId
        ? {
            entries: {
              where: { participantId },
              select: { completed: true, completedById: true, completedBy: { select: { name: true } }, completedAt: true },
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const result = campaigns.map((c) => {
    const entry = (c as Record<string, unknown>).entries as Array<Record<string, unknown>> | undefined;
    return {
      id: c.id,
      name: c.name,
      visibility: c.visibility,
      status: c.status,
      createdByName: c.createdBy.name,
      createdById: c.createdById,
      createdAt: c.createdAt,
      archivedAt: c.archivedAt,
      archivedByName: c.archivedBy?.name ?? null,
      entry: participantId && entry && entry.length > 0 ? entry[0] : null,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, visibility } = await req.json();

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const campaign = await prisma.checklistCampaign.create({
    data: {
      name: name.trim(),
      visibility: visibility === "CREATOR_ONLY" ? "CREATOR_ONLY" : "ALL_STAFF",
      createdById: session.user.id,
    },
    select: {
      id: true,
      name: true,
      visibility: true,
      status: true,
      createdBy: { select: { name: true } },
      createdById: true,
      createdAt: true,
    },
  });

  return NextResponse.json(campaign, { status: 201 });
}
