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
