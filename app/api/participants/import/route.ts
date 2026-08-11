import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import { prisma } from "@/lib/prisma";

function parseHtmlTable(html: string): Array<{
  fcpId: string;
  fcpName: string;
  localParticipantId: string;
  name: string;
  gradeLevel: string;
  gender: string;
  ageText: string;
  communityName: string;
  status: string;
}> {
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) return [];

  const tableHtml = tableMatch[0];
  const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
  const rows: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = rowRegex.exec(tableHtml)) !== null) {
    rows.push(m[0]);
  }

  if (rows.length < 2) return []; // need header + at least one data row

  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

  const results: Array<{
    fcpId: string;
    fcpName: string;
    localParticipantId: string;
    name: string;
    gradeLevel: string;
    gender: string;
    ageText: string;
    communityName: string;
    status: string;
  }> = [];

  for (let i = 1; i < rows.length; i++) {
    const cells: string[] = [];
    let cm: RegExpExecArray | null;
    while ((cm = cellRegex.exec(rows[i])) !== null) {
      cells.push(cm[1].replace(/<[^>]+>/g, "").trim());
    }
    if (cells.length < 9) continue;

    results.push({
      fcpId: cells[0],
      fcpName: cells[1],
      localParticipantId: cells[2],
      name: cells[3],
      gradeLevel: cells[4] || "",
      gender: cells[5] || "",
      ageText: cells[6] || "",
      communityName: cells[7],
      status: cells[8] || "Active",
    });
  }

  return results;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(session.user.role, "MANAGER")) {
    return NextResponse.json({ error: "Only managers can import data" }, { status: 403 });
  }

  let body: { html?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (!body.html || typeof body.html !== "string" || body.html.trim().length === 0) {
    return NextResponse.json({ error: "No HTML content provided" }, { status: 400 });
  }

  const rows = parseHtmlTable(body.html);
  if (rows.length === 0) {
    return NextResponse.json({ error: "No participant rows found in uploaded file" }, { status: 400 });
  }

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const row of rows) {
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

  return NextResponse.json({ created, updated, total: rows.length, errors });
}
