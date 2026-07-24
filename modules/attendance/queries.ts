import { prisma } from "@/lib/prisma";
import type { AttendanceStatus } from "@prisma/client";

const TIMEZONE = "Africa/Addis_Ababa";

function todayDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function getAddisTime(): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const obj: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") obj[p.type] = p.value;
  }
  return new Date(
    Number(obj.year),
    Number(obj.month) - 1,
    Number(obj.day),
    Number(obj.hour),
    Number(obj.minute),
    Number(obj.second)
  );
}

export function isPastCutoff(cutoffTime: string): boolean {
  const [hours, minutes] = cutoffTime.split(":").map(Number);
  const now = getAddisTime();
  const cutoff = new Date(now);
  cutoff.setHours(hours, minutes, 0, 0);
  return now >= cutoff;
}

export function getSecondsUntilCutoff(cutoffTime: string): number {
  const [hours, minutes] = cutoffTime.split(":").map(Number);
  const now = getAddisTime();
  const cutoff = new Date(now);
  cutoff.setHours(hours, minutes, 0, 0);
  const diff = cutoff.getTime() - now.getTime();
  return Math.max(0, Math.floor(diff / 1000));
}

function addisTodayDate(): Date {
  const now = getAddisTime();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function getTodayRecord(userId: string) {
  return prisma.attendanceRecord.findUnique({
    where: {
      userId_date: {
        userId,
        date: todayDate(),
      },
    },
    include: {
      reviewedBy: { select: { id: true, name: true } },
    },
  });
}

export async function createSignIn(userId: string) {
  return prisma.attendanceRecord.create({
    data: {
      userId,
      date: todayDate(),
      signInTime: new Date(),
      requestedStatus: "PRESENT",
      status: "PENDING",
    },
  });
}

export async function createLeaveRequest(
  userId: string,
  requestedStatus: AttendanceStatus,
  note?: string,
  leaveTypeId?: string,
  startDate?: Date,
  endDate?: Date
) {
  const effectiveEnd = endDate ?? startDate ?? todayDate();

  return prisma.attendanceRecord.create({
    data: {
      userId,
      date: effectiveEnd,
      requestedStatus,
      note: note || null,
      status: "PENDING",
      leaveTypeId: leaveTypeId || null,
    },
  });
}

export async function createLeaveRequestBatch(
  userId: string,
  requestedStatus: AttendanceStatus,
  leaveTypeId: string,
  startDate: Date,
  endDate: Date,
  note?: string
) {
  const batchId = crypto.randomUUID();
  const records: {
    userId: string;
    date: Date;
    requestedStatus: AttendanceStatus;
    note: string | null;
    status: AttendanceStatus;
    leaveTypeId: string;
    batchId: string;
  }[] = [];

  const cursor = new Date(startDate);
  const end = new Date(endDate);

  while (cursor <= end) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) {
      records.push({
        userId,
        date: new Date(cursor),
        requestedStatus,
        note: note || null,
        status: "PENDING",
        leaveTypeId,
        batchId,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (records.length === 0) return null;

  await prisma.attendanceRecord.createMany({ data: records });

  return prisma.attendanceRecord.findFirst({
    where: { batchId },
    include: {
      user: { select: { id: true, name: true, email: true, department: true } },
    },
  });
}

export async function getPendingRecords() {
  return prisma.attendanceRecord.findMany({
    where: { status: "PENDING" },
    include: {
      user: { select: { id: true, name: true, email: true, department: true } },
    },
    orderBy: [{ batchId: "asc" }, { date: "asc" }],
  });
}

export async function approveRecord(recordId: string, reviewerId: string) {
  const record = await prisma.attendanceRecord.findUnique({ where: { id: recordId } });
  if (!record) return null;

  const where = record.batchId
    ? { batchId: record.batchId }
    : { id: recordId };

  await prisma.attendanceRecord.updateMany({
    where,
    data: {
      status: record.requestedStatus,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    },
  });

  return prisma.attendanceRecord.findUnique({ where: { id: recordId } });
}

export async function rejectRecord(recordId: string, reviewerId: string) {
  const record = await prisma.attendanceRecord.findUnique({ where: { id: recordId } });
  if (!record) return null;

  const where = record.batchId
    ? { batchId: record.batchId }
    : { id: recordId };

  await prisma.attendanceRecord.updateMany({
    where,
    data: {
      status: "ABSENT",
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    },
  });

  return prisma.attendanceRecord.findUnique({ where: { id: recordId } });
}

export async function getSettings() {
  let settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  if (!settings) {
    settings = await prisma.settings.create({ data: { id: "singleton", cutoffTime: "09:00" } });
  }
  return settings;
}

export async function updateSettings(cutoffTime: string) {
  if (!/^\d{2}:\d{2}$/.test(cutoffTime)) {
    throw new Error("Invalid time format. Use HH:MM (24-hour).");
  }
  const [hours, minutes] = cutoffTime.split(":").map(Number);
  if (hours > 10 || (hours === 10 && minutes > 30)) {
    throw new Error("Cutoff time must not be later than 10:30.");
  }

  return prisma.settings.upsert({
    where: { id: "singleton" },
    update: { cutoffTime },
    create: { id: "singleton", cutoffTime },
  });
}

export async function markAbsentForMissingUsers() {
  const date = addisTodayDate();

  const allUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  const existingRecords = await prisma.attendanceRecord.findMany({
    where: { date },
    select: { userId: true },
  });

  const existingUserIds = new Set(existingRecords.map((r) => r.userId));
  const missingUserIds = allUsers.filter((u) => !existingUserIds.has(u.id)).map((u) => u.id);

  if (missingUserIds.length === 0) return 0;

  await prisma.attendanceRecord.createMany({
    data: missingUserIds.map((userId) => ({
      userId,
      date,
      requestedStatus: "ABSENT",
      status: "ABSENT",
      note: "Auto-marked: no attendance record by cutoff.",
    })),
  });

  return missingUserIds.length;
}

export type MonthlyReportUser = {
  user: { id: string; name: string; email: string; department: string | null };
  present: number;
  absent: number;
  leave: number;
  pending: number;
  records: {
    id: string;
    date: Date;
    status: string;
    note: string | null;
    userName: string;
  }[];
};

export async function getMonthlyReport(
  month: number,
  year: number,
  userId?: string
): Promise<{ summary: MonthlyReportUser[] }> {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const where: Record<string, unknown> = {
    date: { gte: monthStart, lt: monthEnd },
  };
  if (userId) where.userId = userId;

  const records = await prisma.attendanceRecord.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, department: true } },
    },
    orderBy: { date: "asc" },
  });

  const byUser = new Map<
    string,
    {
      user: { id: string; name: string; email: string; department: string | null };
      present: number;
      absent: number;
      leave: number;
      pending: number;
      records: {
        id: string;
        date: Date;
        status: string;
        note: string | null;
        userName: string;
      }[];
    }
  >();

  for (const r of records) {
    const uid = r.userId;
    if (!byUser.has(uid)) {
      byUser.set(uid, {
        user: r.user,
        present: 0,
        absent: 0,
        leave: 0,
        pending: 0,
        records: [],
      });
    }
    const entry = byUser.get(uid)!;
    entry.records.push({
      id: r.id,
      date: r.date,
      status: r.status,
      note: r.note,
      userName: r.user.name,
    });

    switch (r.status) {
      case "PRESENT":
        entry.present++;
        break;
      case "ABSENT":
        entry.absent++;
        break;
      case "PERMISSION":
      case "ANNUAL_LEAVE":
      case "OTHER":
        entry.leave++;
        break;
      case "PENDING":
        entry.pending++;
        break;
    }
  }

  if (userId && byUser.size === 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, department: true },
    });
    if (user) {
      byUser.set(userId, {
        user,
        present: 0,
        absent: 0,
        leave: 0,
        pending: 0,
        records: [],
      });
    }
  } else if (!userId) {
    const allUsers = await prisma.user.findMany({
      select: { id: true, name: true, email: true, department: true },
    });
    for (const u of allUsers) {
      if (!byUser.has(u.id)) {
        byUser.set(u.id, {
          user: u,
          present: 0,
          absent: 0,
          leave: 0,
          pending: 0,
          records: [],
        });
      }
    }
  }

  const summary = Array.from(byUser.values()).sort(
    (a, b) => b.absent - a.absent
  );

  return { summary };
}
