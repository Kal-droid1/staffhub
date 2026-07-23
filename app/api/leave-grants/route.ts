import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import { getLeaveGrants, createLeaveGrant } from "@/modules/leave/queries";

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
  const { userId, leaveTypeId, days, grantedDate, note } = body;

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
