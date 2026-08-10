import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;

  const campaign = await prisma.checklistCampaign.findUnique({ where: { id } });
  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (campaign.visibility === "CREATOR_ONLY" && campaign.createdById !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (campaign.status === "ARCHIVED") {
    return NextResponse.json({ error: "Already archived" }, { status: 400 });
  }

  const updated = await prisma.checklistCampaign.update({
    where: { id },
    data: {
      status: "ARCHIVED",
      archivedAt: new Date(),
      archivedById: userId,
    },
    select: {
      id: true,
      name: true,
      status: true,
      archivedAt: true,
      archivedBy: { select: { name: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;

  const campaign = await prisma.checklistCampaign.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      archivedBy: { select: { name: true } },
      entries: {
        include: {
          participant: {
            select: { id: true, localParticipantId: true, name: true, gradeLevel: true, gender: true, ageText: true, communityName: true, status: true },
          },
          completedBy: { select: { name: true } },
        },
        orderBy: { participant: { name: "asc" } },
      },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (campaign.visibility === "CREATOR_ONLY" && campaign.createdById !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(campaign);
}
