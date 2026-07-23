import { prisma } from "@/lib/prisma";
import type { AttendanceStatus } from "@prisma/client";

function todayDate(): Date {
  const now = new Date();
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
