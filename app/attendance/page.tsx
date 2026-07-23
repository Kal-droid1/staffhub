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
        status: todayRecord.status,
        date: todayRecord.date.toISOString(),
      }
    : null;

  return <AttendanceClient todayRecord={serialized} />;
}
