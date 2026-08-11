import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const participant = await prisma.participant.findUnique({
    where: { id },
    select: {
      id: true,
      fcpId: true,
      fcpName: true,
      localParticipantId: true,
      name: true,
      gradeLevel: true,
      gender: true,
      ageText: true,
      communityName: true,
      status: true,
    },
  });

  if (!participant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(participant);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.participant.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name, localParticipantId, gradeLevel, gender, ageText, communityName, status } = body;

  if (!name || !localParticipantId || !gender || !communityName || !status) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const conflict = await prisma.participant.findFirst({
    where: { localParticipantId, id: { not: id } },
  });
  if (conflict) {
    return NextResponse.json({ error: "Another participant already has this ID" }, { status: 409 });
  }

  const updated = await prisma.participant.update({
    where: { id },
    data: {
      name,
      localParticipantId,
      gradeLevel: gradeLevel ?? null,
      gender,
      ageText: ageText ?? null,
      communityName,
      status,
    },
    select: {
      id: true,
      fcpId: true,
      fcpName: true,
      localParticipantId: true,
      name: true,
      gradeLevel: true,
      gender: true,
      ageText: true,
      communityName: true,
      status: true,
    },
  });

  return NextResponse.json(updated);
}
