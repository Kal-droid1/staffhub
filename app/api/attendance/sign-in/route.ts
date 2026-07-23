import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import {
  getTodayRecord,
  createSignIn,
  createLeaveRequest,
  createLeaveRequestBatch,
  getSettings,
  isPastCutoff,
} from "@/modules/attendance/queries";
import type { AttendanceStatus } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await getTodayRecord(session.user.id);

  if (existing) {
    return NextResponse.json(
      {
        error: "Already recorded today",
        record: {
          id: existing.id,
          signInTime: existing.signInTime?.toISOString() ?? null,
          requestedStatus: existing.requestedStatus,
          note: existing.note,
          status: existing.status,
          date: existing.date.toISOString(),
          reviewedBy: existing.reviewedBy,
        },
      },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action || "signin";

  if (action === "signin") {
    const settings = await getSettings();
    if (isPastCutoff(settings.cutoffTime)) {
      return NextResponse.json(
        { error: `Sign-in closed — cutoff was at ${settings.cutoffTime}. Use Request leave instead.` },
        { status: 403 }
      );
    }

    const record = await createSignIn(session.user.id);
    return NextResponse.json(
      {
        record: {
          id: record.id,
          signInTime: record.signInTime?.toISOString() ?? null,
          requestedStatus: record.requestedStatus,
          note: record.note,
          status: record.status,
          date: record.date.toISOString(),
          reviewedBy: null,
        },
      },
      { status: 201 }
    );
  }

  if (action === "leave") {
    const requestedStatus = (body.requestedStatus as AttendanceStatus) || "PERMISSION";
    const leaveTypeId = body.leaveTypeId || undefined;
    const startDate = body.startDate || undefined;
    const endDate = body.endDate || undefined;

    const isMultiDay = startDate && endDate && startDate !== endDate && leaveTypeId;

    if (isMultiDay) {
      const batchRecord = await createLeaveRequestBatch(
        session.user.id,
        requestedStatus,
        leaveTypeId,
        new Date(startDate),
        new Date(endDate),
        body.note
      );
      return NextResponse.json(
        { multiDayBatch: true, count: body._count, record: null },
        { status: 201 }
      );
    }

    const record = await createLeaveRequest(session.user.id, requestedStatus, body.note, leaveTypeId);
    return NextResponse.json(
      {
        record: {
          id: record.id,
          signInTime: null,
          requestedStatus: record.requestedStatus,
          note: record.note,
          status: record.status,
          date: record.date.toISOString(),
          reviewedBy: null,
        },
      },
      { status: 201 }
    );
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
