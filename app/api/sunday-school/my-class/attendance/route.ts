import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { isUserTeacher, submitClassAttendance } from "@/modules/sunday-school/queries";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    classId?: string;
    year?: number;
    month?: number;
    week?: number;
    records?: { participantId: string; present: boolean }[];
  };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { classId, year, month, week, records } = body;

  if (!classId || typeof classId !== "string") {
    return NextResponse.json({ error: "classId is required." }, { status: 400 });
  }
  if (!Number.isInteger(year) || (year as number) < 2020 || (year as number) > 2100) {
    return NextResponse.json({ error: "Invalid year." }, { status: 400 });
  }
  if (!Number.isInteger(month) || (month as number) < 1 || (month as number) > 12) {
    return NextResponse.json({ error: "Invalid month. Must be 1-12." }, { status: 400 });
  }
  if (!Number.isInteger(week) || (week as number) < 1 || (week as number) > 5) {
    return NextResponse.json({ error: "Invalid week. Must be 1-5." }, { status: 400 });
  }
  if (!Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: "records must be a non-empty array." }, { status: 400 });
  }

  for (const r of records) {
    if (!r || typeof r.participantId !== "string" || typeof r.present !== "boolean") {
      return NextResponse.json(
        { error: "Each record must have participantId (string) and present (boolean)." },
        { status: 400 }
      );
    }
  }

  try {
    if (!(await isUserTeacher(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await submitClassAttendance({
      teacherId: session.user.id,
      classId,
      year: year as number,
      month: month as number,
      week: week as number,
      records,
    });

    if (result.missingCount > 0) {
      return NextResponse.json(
        { error: `Every kid must be marked Present or Absent before submitting. ${result.missingCount} still need a selection.` },
        { status: 400 }
      );
    }

    if (result.updated === 0 && result.invalidParticipantIds.length === 0) {
      return NextResponse.json({ error: "Class not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      updated: result.updated,
      skipped: result.invalidParticipantIds,
      submittedAt: result.submittedAt,
    });
  } catch (e) {
    console.error("Failed to submit attendance:", e);
    return NextResponse.json({ error: "Failed to submit attendance" }, { status: 500 });
  }
}
