import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import { getChronicAbsences } from "@/modules/sunday-school/queries";

const WINDOW_WEEKS = 5;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.role || !hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const rawMin = searchParams.get("minAbsences");
  const minAbsences = rawMin === null ? 3 : Number(rawMin);

  const rawYear = searchParams.get("year");
  const rawMonth = searchParams.get("month");
  const year = rawYear === null ? null : Number(rawYear);
  const month = rawMonth === null ? null : Number(rawMonth);

  if (!Number.isInteger(minAbsences) || minAbsences < 1 || minAbsences > 20) {
    return NextResponse.json({ error: "Invalid minAbsences. Must be 1-20." }, { status: 400 });
  }
  if ((year === null) !== (month === null)) {
    return NextResponse.json({ error: "year and month must be provided together." }, { status: 400 });
  }
  if (year !== null && (!Number.isInteger(year) || year < 2020 || year > 2100)) {
    return NextResponse.json({ error: "Invalid year." }, { status: 400 });
  }
  if (month !== null && (!Number.isInteger(month) || month < 1 || month > 12)) {
    return NextResponse.json({ error: "Invalid month. Must be 1-12." }, { status: 400 });
  }

  try {
    const participants = await getChronicAbsences({
      minAbsences,
      windowWeeks: WINDOW_WEEKS,
      ...(year !== null && month !== null ? { year, month } : {}),
    });
    return NextResponse.json({
      minAbsences,
      windowWeeks: year === null ? WINDOW_WEEKS : null,
      year,
      month,
      participants,
    });
  } catch (e) {
    console.error("Failed to load chronic absences:", e);
    return NextResponse.json({ error: "Failed to load chronic absences" }, { status: 500 });
  }
}
