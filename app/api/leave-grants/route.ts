import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import { getLeaveGrants, createLeaveGrant, updateLeaveGrant, deleteLeaveGrant, createBulkLeaveGrants } from "@/modules/leave/queries";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || undefined;

  if (userId && !hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const grants = await getLeaveGrants(userId || session.user.id);
  return NextResponse.json(grants);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || !hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { userId, leaveTypeId, days, grantedDate, note, bulk } = body;

  if (bulk) {
    if (!leaveTypeId || typeof days !== "number" || days <= 0) {
      return NextResponse.json({ error: "leaveTypeId and a positive days value are required for bulk grants." }, { status: 400 });
    }
    try {
      const grants = await createBulkLeaveGrants(
        leaveTypeId,
        days,
        grantedDate ? new Date(grantedDate) : new Date(),
        note
      );
      return NextResponse.json(grants, { status: 201 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create bulk grants";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  if (!userId || !leaveTypeId || typeof days !== "number" || days <= 0) {
    return NextResponse.json({ error: "userId, leaveTypeId, and a positive days value are required." }, { status: 400 });
  }

  try {
    const grant = await createLeaveGrant(
      userId,
      leaveTypeId,
      days,
      grantedDate ? new Date(grantedDate) : new Date(),
      note
    );
    return NextResponse.json(grant, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create grant";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || !hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { id, days, grantedDate, note } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const data: { days?: number; grantedDate?: Date; note?: string } = {};
  if (typeof days === "number" && days > 0) data.days = days;
  if (grantedDate) data.grantedDate = new Date(grantedDate);
  if (note !== undefined) data.note = note;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  try {
    const grant = await updateLeaveGrant(id, data);
    return NextResponse.json(grant);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update grant";
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
    return NextResponse.json({ error: "id query param is required." }, { status: 400 });
  }

  try {
    await deleteLeaveGrant(id);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete grant";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
