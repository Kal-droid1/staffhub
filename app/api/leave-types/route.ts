import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import { getLeaveTypes, createLeaveType, updateLeaveType, deleteLeaveType } from "@/modules/leave/queries";
import type { AttendanceStatus } from "@prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const types = await getLeaveTypes();
  return NextResponse.json(types);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || !hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { name, isAnnualRecurring, mappedStatus, defaultDays } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (typeof isAnnualRecurring !== "boolean") {
    return NextResponse.json({ error: "isAnnualRecurring must be a boolean." }, { status: 400 });
  }

  try {
    const leaveType = await createLeaveType(
      name.trim(),
      isAnnualRecurring,
      mappedStatus as AttendanceStatus,
      typeof defaultDays === "number" ? defaultDays : undefined
    );
    return NextResponse.json(leaveType, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create leave type";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || !hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { id, name, isAnnualRecurring, defaultDays } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const data: { name?: string; isAnnualRecurring?: boolean; defaultDays?: number } = {};
  if (typeof name === "string" && name.trim().length > 0) data.name = name.trim();
  if (typeof isAnnualRecurring === "boolean") data.isAnnualRecurring = isAnnualRecurring;
  if (typeof defaultDays === "number") data.defaultDays = defaultDays;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  try {
    const leaveType = await updateLeaveType(id, data);
    return NextResponse.json(leaveType);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update leave type";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
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

  try {
    await deleteLeaveType(id);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete leave type";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
