import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { campaignId, participantId, completed } = await req.json();

  if (!campaignId || !participantId) {
    return NextResponse.json({ error: "campaignId and participantId are required" }, { status: 400 });
  }

  const campaign = await prisma.checklistCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (campaign.visibility === "CREATOR_ONLY" && campaign.createdById !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (campaign.status !== "ACTIVE") {
    return NextResponse.json({ error: "Campaign is not active" }, { status: 400 });
  }

  const entry = await prisma.checklistEntry.upsert({
    where: {
      campaignId_participantId: { campaignId, participantId },
    },
    create: {
      campaignId,
      participantId,
      completed: !!completed,
      completedById: completed ? userId : null,
      completedAt: completed ? new Date() : null,
    },
    update: {
      completed: !!completed,
      completedById: completed ? userId : null,
      completedAt: completed ? new Date() : null,
    },
    select: {
      id: true,
      completed: true,
      completedAt: true,
      completedBy: { select: { name: true } },
    },
  });

  return NextResponse.json(entry);
}
