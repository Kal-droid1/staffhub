import { prisma } from "@/lib/prisma";
import type { AttendanceStatus } from "@prisma/client";
import { getLeaveBalances } from "@/modules/leave/queries";

export async function applyCompanyLeave(args: {
  leaveTypeId: string;
  startDate: Date;
  endDate: Date;
  label?: string;
  createdById: string;
}) {
  const leaveType = await prisma.leaveType.findUnique({ where: { id: args.leaveTypeId } });
  if (!leaveType) throw new Error("Leave type not found");
  if (args.startDate > args.endDate) throw new Error("Start date must be on or before end date");

  const dates: Date[] = [];
  const cursor = new Date(args.startDate);
  const end = new Date(args.endDate);
  while (cursor <= end) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  if (dates.length === 0) throw new Error("Selected range contains no weekdays");

  const users = await prisma.user.findMany({
    where: { isActive: true, hideFromReports: false, deletedAt: null },
    select: { id: true },
  });

  const existing = await prisma.attendanceRecord.findMany({
    where: { userId: { in: users.map((u) => u.id) }, date: { in: dates } },
    select: { userId: true, date: true },
  });
  const conflictSet = new Set(existing.map((r) => `${r.userId}|${r.date.toISOString()}`));

  const id = crypto.randomUUID();
  const records: {
    userId: string;
    date: Date;
    requestedStatus: AttendanceStatus;
    status: AttendanceStatus;
    leaveTypeId: string;
    note: string | null;
    batchId: string;
    reviewedById: string;
    reviewedAt: Date;
  }[] = [];
  let skippedRecords = 0;

  for (const u of users) {
    for (const d of dates) {
      if (conflictSet.has(`${u.id}|${d.toISOString()}`)) {
        skippedRecords++;
        continue;
      }
      records.push({
        userId: u.id,
        date: d,
        requestedStatus: leaveType.mappedStatus,
        status: leaveType.mappedStatus,
        leaveTypeId: leaveType.id,
        note: args.label || null,
        batchId: id,
        reviewedById: args.createdById,
        reviewedAt: new Date(),
      });
    }
  }

  const affectedUserIds = [...new Set(records.map((r) => r.userId))];

  await prisma.$transaction([
    prisma.bulkLeaveAction.create({
      data: {
        id,
        label: args.label || null,
        leaveTypeId: leaveType.id,
        startDate: args.startDate,
        endDate: args.endDate,
        batchId: id,
        createdById: args.createdById,
        affectedStaff: affectedUserIds.length,
        skippedRecords,
        insufficientStaff: 0,
      },
    }),
    prisma.attendanceRecord.createMany({ data: records }),
  ]);

  let insufficientStaff = 0;
  for (const uid of affectedUserIds) {
    const balances = await getLeaveBalances(uid);
    const b = balances.find((x) => x.leaveTypeId === leaveType.id);
    if (b && b.remaining < 0) insufficientStaff++;
  }

  await prisma.bulkLeaveAction.update({
    where: { id },
    data: { insufficientStaff },
  });

  return {
    actionId: id,
    affectedStaff: affectedUserIds.length,
    skippedRecords,
    insufficientStaff,
  };
}

export async function getCompanyLeaveActions() {
  return prisma.bulkLeaveAction.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
    include: {
      leaveType: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });
}

export async function undoCompanyLeave(id: string) {
  const action = await prisma.bulkLeaveAction.findUnique({ where: { id } });
  if (!action) throw new Error("Company leave action not found");

  await prisma.$transaction([
    prisma.attendanceRecord.deleteMany({ where: { batchId: action.batchId } }),
    prisma.bulkLeaveAction.delete({ where: { id } }),
  ]);
}
