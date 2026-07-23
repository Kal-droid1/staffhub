import { requireAuth } from "@/modules/core/require-auth";
import { getTodayRecord, getSettings, getSecondsUntilCutoff, getPendingRecords } from "@/modules/attendance/queries";
import { getLeaveTypes, getLeaveBalances } from "@/modules/leave/queries";
import AttendanceClient from "./attendance-client";

export default async function AttendancePage() {
  const user = await requireAuth();
  const todayRecord = await getTodayRecord(user.id);
  const settings = await getSettings();
  const secondsUntil = getSecondsUntilCutoff(settings.cutoffTime);
  const leaveTypes = await getLeaveTypes();

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

  let pending: {
    id: string;
    date: string;
    signInTime: string | null;
    requestedStatus: string;
    leaveTypeId: string | null;
    batchId: string | null;
    note: string | null;
    user: {
      id: string;
      name: string;
      email: string;
      department: string | null;
    };
  }[] = [];
  let balancesMap: Record<string, { leaveTypeId: string; leaveTypeName: string; isAnnualRecurring: boolean; granted: number; used: number; remaining: number }[]> = {};

  if (user.role === "MANAGER" || user.role === "ADMIN") {
    const pendingRecords = await getPendingRecords();
    pending = pendingRecords.map((r) => ({
      id: r.id,
      date: r.date.toISOString(),
      signInTime: r.signInTime?.toISOString() ?? null,
      requestedStatus: r.requestedStatus,
      leaveTypeId: r.leaveTypeId,
      batchId: r.batchId,
      note: r.note,
      user: {
        id: r.user.id,
        name: r.user.name,
        email: r.user.email,
        department: r.user.department,
      },
    }));

    for (const r of pendingRecords) {
      if (!balancesMap[r.userId]) {
        balancesMap[r.userId] = await getLeaveBalances(r.userId);
      }
    }
  }

  const ownBalances = await getLeaveBalances(user.id);

  return (
    <AttendanceClient
      userRole={user.role}
      currentUserId={user.id}
      todayRecord={serialized}
      cutoffTime={settings.cutoffTime}
      initialSecondsUntil={secondsUntil}
      leaveTypes={JSON.parse(JSON.stringify(leaveTypes))}
      pendingRecords={pending}
      balances={JSON.parse(JSON.stringify(balancesMap))}
      ownBalances={JSON.parse(JSON.stringify(ownBalances))}
    />
  );
}
