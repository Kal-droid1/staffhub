import { requireAuth } from "@/modules/core/require-auth";
import { getTodayRecord, getSettings, getSecondsUntilCutoff, getSecondsUntilTomorrowCutoff, getPendingRecords, isWeekend } from "@/modules/attendance/queries";
import { getLeaveTypes, getLeaveBalances } from "@/modules/leave/queries";
import { prisma } from "@/lib/prisma";
import AttendanceClient from "./attendance-client";

export default async function AttendancePage() {
  const user = await requireAuth();
  const todayRecord = await getTodayRecord(user.id);
  const settings = await getSettings();
  const secondsUntil = getSecondsUntilCutoff(settings.cutoffTime);
  const secondsUntilTomorrow = getSecondsUntilTomorrowCutoff(settings.cutoffTime);
  const leaveTypes = await getLeaveTypes();

  // check for active approved leave spanning future dates
  let ongoingLeaveUntil: string | null = null;
  const now = new Date();
  const futureApproved = await prisma.attendanceRecord.findMany({
    where: {
      userId: user.id,
      date: { gte: now },
      status: { notIn: ["PENDING", "ABSENT"] },
      leaveTypeId: { not: null },
    },
    orderBy: { date: "asc" },
    select: { date: true },
  });
  if (futureApproved.length > 0) {
    const lastDate = futureApproved[futureApproved.length - 1].date;
    ongoingLeaveUntil = lastDate.toISOString();
  }

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
    attachmentUrl: string | null;
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
      attachmentUrl: r.attachmentUrl,
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
      initialOfficeLatitude={settings.officeLatitude ?? null}
      initialOfficeLongitude={settings.officeLongitude ?? null}
      initialAllowedRadiusMeters={settings.allowedRadiusMeters}
      isWeekend={isWeekend()}
      initialSecondsUntil={secondsUntil}
      initialSecondsUntilTomorrow={secondsUntilTomorrow}
      ongoingLeaveUntil={ongoingLeaveUntil}
      leaveTypes={JSON.parse(JSON.stringify(leaveTypes))}
      pendingRecords={pending}
      balances={JSON.parse(JSON.stringify(balancesMap))}
      ownBalances={JSON.parse(JSON.stringify(ownBalances))}
    />
  );
}
