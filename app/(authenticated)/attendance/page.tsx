import { requireAuth } from "@/modules/core/require-auth";
import { getTodayRecord } from "@/modules/attendance/queries";
import AttendanceClient from "./attendance-client";

export default async function AttendancePage() {
  const user = await requireAuth();
  const todayRecord = await getTodayRecord(user.id);

  const serialized = todayRecord
    ? {
        id: todayRecord.id,
        signInTime: todayRecord.signInTime?.toISOString() ?? null,
        requestedStatus: todayRecord.requestedStatus,
        note: todayRecord.note,
        status: todayRecord.status,
        date: todayRecord.date.toISOString(),
        reviewedBy: todayRecord.reviewedBy
          ? { id: todayRecord.reviewedBy.id, name: todayRecord.reviewedBy.name }
          : null,
      }
    : null;

  return <AttendanceClient todayRecord={serialized} />;
}
