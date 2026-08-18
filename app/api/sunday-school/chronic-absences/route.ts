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

  if (!Number.isInteger(minAbsences) || minAbsences < 1 || minAbsences > 20) {
    return NextResponse.json({ error: "Invalid minAbsences. Must be 1-20." }, { status: 400 });
  }

  try {
    const participants = await getChronicAbsences({ minAbsences, windowWeeks: WINDOW_WEEKS });
    return NextResponse.json({ minAbsences, windowWeeks: WINDOW_WEEKS, participants });
  } catch (e) {
    console.error("Failed to load chronic absences:", e);
    return NextResponse.json({ error: "Failed to load chronic absences" }, { status: 500 });
  }
}
