import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { approveRecord, rejectRecord } from "@/modules/attendance/queries";
import { hasRole } from "@/modules/core/roles";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { recordId, action } = body;

  if (!recordId || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (action === "approve") {
    const record = await approveRecord(recordId, session.user.id);
    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, status: record.status });
  }

  const record = await rejectRecord(recordId, session.user.id);
  return NextResponse.json({ success: true, status: record.status });
}
