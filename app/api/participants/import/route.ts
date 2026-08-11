import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(session.user.role, "MANAGER")) {
    return NextResponse.json({ error: "Only managers can import data" }, { status: 403 });
  }

  let body: { rows?: Array<{
    fcpId: string;
    fcpName: string;
    localParticipantId: string;
    name: string;
    gradeLevel: string;
    gender: string;
    ageText: string;
    communityName: string;
    status: string;
  }> };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (!body.rows || !Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const row of body.rows) {
    if (!row.localParticipantId || !row.name) {
      errors.push(`Skipped row with missing ID or name: ${row.localParticipantId || "unknown"}`);
      continue;
    }

    try {
      const existing = await prisma.participant.findUnique({
        where: { localParticipantId: row.localParticipantId },
      });

      if (existing) {
        await prisma.participant.update({
          where: { localParticipantId: row.localParticipantId },
          data: {
            name: row.name,
            fcpId: row.fcpId,
            fcpName: row.fcpName,
            gradeLevel: row.gradeLevel || null,
            gender: row.gender,
            ageText: row.ageText || null,
            communityName: row.communityName,
            status: row.status,
          },
        });
        updated++;
      } else {
        await prisma.participant.create({
          data: {
            fcpId: row.fcpId,
            fcpName: row.fcpName,
            localParticipantId: row.localParticipantId,
            name: row.name,
            gradeLevel: row.gradeLevel || null,
            gender: row.gender,
            ageText: row.ageText || null,
            communityName: row.communityName,
            status: row.status,
          },
        });
        created++;
      }
    } catch (e) {
      errors.push(`Failed to process ${row.localParticipantId}: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  return NextResponse.json({ created, updated, errors });
}
