import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import { getSundaySchoolSubmissionSummary } from "@/modules/sunday-school/queries";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.role || !hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  const week = Number(searchParams.get("week"));

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
    const classes = await getSundaySchoolSubmissionSummary({ year, month, week });
    return NextResponse.json({ year, month, week, classes });
  } catch (e) {
    console.error("Failed to load submission summary:", e);
    return NextResponse.json({ error: "Failed to load submission summary" }, { status: 500 });
  }
}
