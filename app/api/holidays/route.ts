import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import { getHolidaysByYear, createHoliday, deleteHoliday } from "@/lib/holidays";
import { gregorianToEthiopianYear } from "@/lib/ethiopian-date";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || !hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const yearStr = searchParams.get("year");

  if (!yearStr) {
    const today = new Date();
    const year = gregorianToEthiopianYear(today);
    const holidays = await getHolidaysByYear(year);
    return NextResponse.json(holidays);
  }

  const year = Number(yearStr);
  if (!Number.isInteger(year) || year < 1) {
    return NextResponse.json({ error: "Invalid year." }, { status: 400 });
  }

  const holidays = await getHolidaysByYear(year);
  return NextResponse.json(holidays);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || !hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { date, name, year } = body;

  if (!date || !name || !year) {
    return NextResponse.json({ error: "date, name, and year are required." }, { status: 400 });
  }

  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }

  const holiday = await createHoliday(parsed, name, year, false);
  return NextResponse.json(holiday, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || !hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  await deleteHoliday(id);
  return NextResponse.json({ success: true });
}
