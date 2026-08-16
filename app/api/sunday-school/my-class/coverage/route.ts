import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import {
  isUserTeacher,
  listMyCoverages,
  createCoverage,
} from "@/modules/sunday-school/queries";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!(await isUserTeacher(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const coverages = await listMyCoverages(session.user.id);
    return NextResponse.json({ coverages });
  } catch (e) {
    console.error("Failed to load coverage arrangements:", e);
    return NextResponse.json({ error: "Failed to load coverage arrangements" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    classId?: string;
    substituteId?: string;
    year?: number;
    month?: number;
    weekStart?: number;
    weekEnd?: number;
  };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { classId, substituteId, year, month, weekStart, weekEnd } = body;

  if (!classId || typeof classId !== "string") {
    return NextResponse.json({ error: "classId is required." }, { status: 400 });
  }
  if (!substituteId || typeof substituteId !== "string") {
    return NextResponse.json({ error: "substituteId is required." }, { status: 400 });
  }
  if (!Number.isInteger(year) || (year as number) < 2020 || (year as number) > 2100) {
    return NextResponse.json({ error: "Invalid year." }, { status: 400 });
  }
  if (!Number.isInteger(month) || (month as number) < 1 || (month as number) > 12) {
    return NextResponse.json({ error: "Invalid month. Must be 1-12." }, { status: 400 });
  }
  if (!Number.isInteger(weekStart) || !Number.isInteger(weekEnd)) {
    return NextResponse.json({ error: "Invalid week range." }, { status: 400 });
  }

  try {
    if (!(await isUserTeacher(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const coverage = await createCoverage({
      teacherId: session.user.id,
      classId,
      substituteId,
      year: year as number,
      month: month as number,
      weekStart: weekStart as number,
      weekEnd: weekEnd as number,
    });

    return NextResponse.json(coverage, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to arrange coverage";
    console.error("Failed to arrange coverage:", e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
