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
import { put } from "@vercel/blob";

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

  const contentType = req.headers.get("content-type") || "";
  const isMultipart = contentType.includes("multipart/form-data");

  let action: string;
  let body: Record<string, unknown> = {};
  let formData: FormData | undefined;
  if (isMultipart) {
    formData = await req.formData();
    action = (formData.get("action") as string) || "signin";
  } else {
    body = await req.json().catch(() => ({}));
    action = (body.action as string) || "signin";
  }

  if (action === "signin") {
    const settings = await getSettings();
    if (isPastCutoff(settings.cutoffTime)) {
      return NextResponse.json(
        { error: `Sign-in closed — cutoff was at ${settings.cutoffTime}. Use Request leave instead.` },
        { status: 403 }
      );
    }

    if (settings.officeLatitude != null && settings.officeLongitude != null) {
      const latitude = body.latitude as number | undefined;
      const longitude = body.longitude as number | undefined;
      if (latitude === undefined || longitude === undefined) {
        return NextResponse.json(
          { error: "You must be at the office to sign in. Contact your manager if this is incorrect." },
          { status: 403 }
        );
      }
      const { haversineDistance } = await import("@/modules/attendance/queries");
      const dist = haversineDistance(latitude, longitude, settings.officeLatitude, settings.officeLongitude);
      if (dist > settings.allowedRadiusMeters) {
        return NextResponse.json(
          { error: "You must be at the office to sign in. Contact your manager if this is incorrect." },
          { status: 403 }
        );
      }
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
    let requestedStatus: AttendanceStatus;
    let leaveTypeId: string | undefined;
    let startDate: string | undefined;
    let endDate: string | undefined;
    let note: string | undefined;
    let attachmentUrl: string | undefined;

    if (isMultipart && formData) {
      requestedStatus = (formData.get("requestedStatus") as AttendanceStatus) || "PERMISSION";
      leaveTypeId = (formData.get("leaveTypeId") as string) || undefined;
      startDate = (formData.get("startDate") as string) || undefined;
      endDate = (formData.get("endDate") as string) || undefined;
      note = (formData.get("note") as string) || undefined;
      const file = formData.get("file") as File | null;
      if (file && file.size > 0) {
        const blob = await put(`leave-attachments/${file.name}`, file, { access: "private", addRandomSuffix: true });
        attachmentUrl = blob.url;
      }
    } else {
      const body = await req.json().catch(() => ({}));
      requestedStatus = (body.requestedStatus as AttendanceStatus) || "PERMISSION";
      leaveTypeId = body.leaveTypeId || undefined;
      startDate = body.startDate || undefined;
      endDate = body.endDate || undefined;
      note = body.note || undefined;
    }

    const isMultiDay = startDate && endDate && startDate !== endDate && leaveTypeId;

    if (isMultiDay) {
      await createLeaveRequestBatch(
        session.user.id,
        requestedStatus,
        leaveTypeId!,
        new Date(startDate!),
        new Date(endDate!),
        note,
        attachmentUrl
      );
      return NextResponse.json(
        { multiDayBatch: true, count: 0, record: null },
        { status: 201 }
      );
    }

    const record = await createLeaveRequest(session.user.id, requestedStatus, note, leaveTypeId, undefined, undefined, attachmentUrl);
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
