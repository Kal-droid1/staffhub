import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { isUserTeacher, getClassRosterForTeacher } from "@/modules/sunday-school/queries";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  const week = Number(searchParams.get("week"));

  if (!classId) {
    return NextResponse.json({ error: "classId is required." }, { status: 400 });
  }
  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    return NextResponse.json({ error: "Invalid year." }, { status: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid month. Must be 1-12." }, { status: 400 });
  }
  if (!Number.isInteger(week) || week < 1 || week > 5) {
    return NextResponse.json({ error: "Invalid week. Must be 1-5." }, { status: 400 });
  }

  try {
    if (!(await isUserTeacher(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const roster = await getClassRosterForTeacher({
      teacherId: session.user.id,
      classId,
      year,
      month,
      week,
    });

    if (!roster.classInfo) {
      return NextResponse.json({ error: "Class not found." }, { status: 404 });
    }

    return NextResponse.json(roster);
  } catch (e) {
    console.error("Failed to load roster:", e);
    return NextResponse.json({ error: "Failed to load roster" }, { status: 500 });
  }
}
