import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import ExcelJS from "exceljs";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import { prisma } from "@/lib/prisma";
import { parseRosterUpload } from "@/modules/sunday-school/roster-upload";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.role || !hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart file upload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required." }, { status: 400 });
  }

  let ids: string[];

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    // @ts-expect-error -- Buffer type mismatch between Node and exceljs types; works at runtime
    await workbook.xlsx.load(buffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return NextResponse.json({ error: "No worksheet found in the uploaded file." }, { status: 400 });
    }

    ids = parseRosterUpload(sheet).ids;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read the uploaded Excel file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (ids.length === 0) {
    return NextResponse.json({ error: "No participant IDs found in the uploaded file." }, { status: 400 });
  }

  const participants = await prisma.participant.findMany({
    where: { localParticipantId: { in: ids } },
    select: {
      id: true,
      localParticipantId: true,
      name: true,
      gradeLevel: true,
    },
  });

  const matchedById = new Map(participants.map((p) => [p.localParticipantId.toUpperCase(), p]));
  const matched = ids
    .filter((id) => matchedById.has(id))
    .map((id) => matchedById.get(id)!);
  const notFound = ids.filter((id) => !matchedById.has(id));

  return NextResponse.json({ matched, notFound });
}
