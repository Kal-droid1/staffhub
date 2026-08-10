import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q || q.trim().length === 0) {
    return NextResponse.json([]);
  }

  const query = q.trim();

  const participants = await prisma.participant.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { localParticipantId: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      localParticipantId: true,
      name: true,
      gradeLevel: true,
      gender: true,
      ageText: true,
      communityName: true,
      status: true,
    },
    orderBy: { name: "asc" },
    take: 50,
  });

  return NextResponse.json(participants);
}
