import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { isUserTeacher, listCoveredClassesForSubstitute } from "@/modules/sunday-school/queries";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    if (!(await isUserTeacher(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const classes = await listCoveredClassesForSubstitute(session.user.id, year, month, week);
    return NextResponse.json({ classes });
  } catch (e) {
    console.error("Failed to load covered classes:", e);
    return NextResponse.json({ error: "Failed to load covered classes" }, { status: 500 });
  }
}
