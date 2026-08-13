import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import {
  applyCompanyLeave,
  getCompanyLeaveActions,
  undoCompanyLeave,
} from "@/modules/company-leave/queries";

function managerGuard(session: Session | null) {
  if (!session?.user?.role) return false;
  return hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER");
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!managerGuard(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const actions = await getCompanyLeaveActions();
    return NextResponse.json(actions);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load company leave actions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!managerGuard(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { leaveTypeId, startDate, endDate, label } = body;

  if (!leaveTypeId || !startDate || !endDate) {
    return NextResponse.json(
      { error: "leaveTypeId, startDate, and endDate are required." },
      { status: 400 }
    );
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid date format." }, { status: 400 });
  }

  try {
    const summary = await applyCompanyLeave({
      leaveTypeId,
      startDate: start,
      endDate: end,
      label: typeof label === "string" && label.trim() ? label.trim() : undefined,
      createdById: session!.user!.id,
    });
    return NextResponse.json(summary, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to apply company leave";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!managerGuard(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id query param is required." }, { status: 400 });
  }

  try {
    await undoCompanyLeave(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to undo company leave";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
