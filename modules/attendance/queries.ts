import { prisma } from "@/lib/prisma";

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
  });
}

export async function createSignIn(userId: string) {
  return prisma.attendanceRecord.create({
    data: {
      userId,
      date: todayDate(),
      signInTime: new Date(),
      status: "PENDING",
    },
  });
}
