import { prisma } from "@/lib/prisma";
import type { AttendanceStatus, LeaveType as LeaveTypeModel, LeaveGrant as LeaveGrantModel } from "@prisma/client";

export type LeaveTypeRow = LeaveTypeModel;
export type LeaveGrantRow = LeaveGrantModel & {
  user: { id: string; name: string; email: string };
  leaveType: { id: string; name: string };
};

export type LeaveBalance = {
  leaveTypeId: string;
  leaveTypeName: string;
  isAnnualRecurring: boolean;
  granted: number;
  used: number;
  remaining: number;
};

export type LeaveBalanceSummary = {
  userId: string;
  userName: string;
  balances: LeaveBalance[];
};

function addisTodayDate(): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [year, month, day] = formatter.format(now).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export async function getLeaveTypes(): Promise<LeaveTypeRow[]> {
  return prisma.leaveType.findMany({ orderBy: { name: "asc" } });
}

export async function createLeaveType(
  name: string,
  isAnnualRecurring: boolean,
  mappedStatus: AttendanceStatus
): Promise<LeaveTypeRow> {
  return prisma.leaveType.create({
    data: { name, isAnnualRecurring, mappedStatus },
  });
}

export async function updateLeaveType(
  id: string,
  data: { name?: string; isAnnualRecurring?: boolean }
): Promise<LeaveTypeRow> {
  return prisma.leaveType.update({
    where: { id },
    data,
  });
}

export async function getLeaveGrants(userId?: string): Promise<LeaveGrantRow[]> {
  return prisma.leaveGrant.findMany({
    where: userId ? { userId } : undefined,
    include: {
      user: { select: { id: true, name: true, email: true } },
      leaveType: { select: { id: true, name: true } },
    },
    orderBy: { grantedDate: "desc" },
  });
}

export async function createLeaveGrant(
  userId: string,
  leaveTypeId: string,
  days: number,
  grantedDate: Date,
  note?: string
): Promise<LeaveGrantRow> {
  const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
  if (!leaveType) throw new Error("Leave type not found");

  let expiresAt: Date | null = null;
  if (leaveType.isAnnualRecurring) {
    expiresAt = new Date(grantedDate.getFullYear() + 2, grantedDate.getMonth(), 1);
  }

  return prisma.leaveGrant.create({
    data: {
      userId,
      leaveTypeId,
      days,
      grantedDate,
      note: note || null,
      expiresAt,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      leaveType: { select: { id: true, name: true } },
    },
  });
}

export async function createBulkLeaveGrants(
  leaveTypeId: string,
  days: number,
  grantedDate: Date,
  note?: string
): Promise<LeaveGrantRow[]> {
  const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
  if (!leaveType) throw new Error("Leave type not found");

  const allUsers = await prisma.user.findMany({ select: { id: true } });

  let expiresAt: Date | null = null;
  if (leaveType.isAnnualRecurring) {
    expiresAt = new Date(grantedDate.getFullYear() + 2, grantedDate.getMonth(), 1);
  }

  const data = allUsers.map((u) => ({
    userId: u.id,
    leaveTypeId,
    days,
    grantedDate,
    note: note || null,
    expiresAt,
  }));

  await prisma.leaveGrant.createMany({ data });

  return prisma.leaveGrant.findMany({
    where: { leaveTypeId, grantedDate },
    include: {
      user: { select: { id: true, name: true, email: true } },
      leaveType: { select: { id: true, name: true } },
    },
  });
}

export async function updateLeaveGrant(
  id: string,
  data: { days?: number; grantedDate?: Date; note?: string }
): Promise<LeaveGrantRow> {
  const grant = await prisma.leaveGrant.findUnique({ where: { id } });
  if (!grant) throw new Error("Grant not found");

  const updateData: Record<string, unknown> = {};
  if (data.days !== undefined) updateData.days = data.days;
  if (data.grantedDate !== undefined) {
    updateData.grantedDate = data.grantedDate;
    const leaveType = await prisma.leaveType.findUnique({ where: { id: grant.leaveTypeId } });
    if (leaveType?.isAnnualRecurring) {
      updateData.expiresAt = new Date(data.grantedDate.getFullYear() + 2, data.grantedDate.getMonth(), 1);
    }
  }
  if (data.note !== undefined) updateData.note = data.note || null;

  return prisma.leaveGrant.update({
    where: { id },
    data: updateData,
    include: {
      user: { select: { id: true, name: true, email: true } },
      leaveType: { select: { id: true, name: true } },
    },
  });
}

export async function deleteLeaveGrant(id: string): Promise<void> {
  await prisma.leaveGrant.delete({ where: { id } });
}

export async function getLeaveBalances(userId: string): Promise<LeaveBalance[]> {
  const today = addisTodayDate();
  const leaveTypes = await prisma.leaveType.findMany({ orderBy: { name: "asc" } });

  const balances: LeaveBalance[] = [];

  for (const lt of leaveTypes) {
    const validGrants = await prisma.leaveGrant.findMany({
      where: {
        userId,
        leaveTypeId: lt.id,
        OR: [{ expiresAt: null }, { expiresAt: { gte: today } }],
      },
      orderBy: { grantedDate: "asc" },
    });

    const granted = validGrants.reduce((sum, g) => sum + g.days, 0);

    const earliestGrantDate =
      validGrants.length > 0 ? validGrants[0].grantedDate : today;

    const usedRecords = await prisma.attendanceRecord.findMany({
      where: {
        userId,
        leaveTypeId: lt.id,
        status: { in: ["PERMISSION", "ANNUAL_LEAVE", "OTHER"] },
        date: { gte: earliestGrantDate },
      },
    });

    const used = usedRecords.length;

    balances.push({
      leaveTypeId: lt.id,
      leaveTypeName: lt.name,
      isAnnualRecurring: lt.isAnnualRecurring,
      granted,
      used,
      remaining: granted - used,
    });
  }

  return balances;
}

export async function getLeaveBalanceSummary(): Promise<LeaveBalanceSummary[]> {
  const users = await prisma.user.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const results: LeaveBalanceSummary[] = [];
  for (const u of users) {
    const balances = await getLeaveBalances(u.id);
    results.push({ userId: u.id, userName: u.name, balances });
  }
  return results;
}

export async function getLeaveTypeByStatus(status: AttendanceStatus) {
  return prisma.leaveType.findFirst({ where: { mappedStatus: status } });
}
