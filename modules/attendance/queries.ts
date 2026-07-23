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
  note?: string
) {
  return prisma.attendanceRecord.create({
    data: {
      userId,
      date: todayDate(),
      requestedStatus,
      note: note || null,
      status: "PENDING",
    },
  });
}

export async function getPendingRecords() {
  return prisma.attendanceRecord.findMany({
    where: { status: "PENDING" },
    include: {
      user: { select: { id: true, name: true, email: true, department: true } },
    },
    orderBy: { date: "desc" },
  });
}

export async function approveRecord(recordId: string, reviewerId: string) {
  const record = await prisma.attendanceRecord.findUnique({ where: { id: recordId } });
  if (!record) return null;

  return prisma.attendanceRecord.update({
    where: { id: recordId },
    data: {
      status: record.requestedStatus,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    },
  });
}

export async function rejectRecord(recordId: string, reviewerId: string) {
  return prisma.attendanceRecord.update({
    where: { id: recordId },
    data: {
      status: "ABSENT",
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    },
  });
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
