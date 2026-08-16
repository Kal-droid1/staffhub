import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import { getClassAttendanceHistory } from "@/modules/sunday-school/queries";

function managerGuard(role: unknown): boolean {
  return hasRole(role as "MANAGER" | "ADMIN", "MANAGER");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.role || !managerGuard(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));

  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    return NextResponse.json({ error: "Invalid year." }, { status: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid month. Must be 1-12." }, { status: 400 });
  }

  try {
    const history = await getClassAttendanceHistory({ classId: id, year, month });
    if (!history) {
      return NextResponse.json({ error: "Class not found." }, { status: 404 });
    }
    return NextResponse.json(history);
  } catch (e) {
    console.error("Failed to load class attendance history:", e);
    return NextResponse.json({ error: "Failed to load attendance history" }, { status: 500 });
  }
}
