import { PrismaClient, AttendanceStatus, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TEST_PASSWORD = "password123";

const reportTestUsers = [
  { name: "Dave Dev", email: "dave@staffhub.test", role: Role.STAFF, department: "Engineering" },
  { name: "Eve Ops", email: "eve@staffhub.test", role: Role.STAFF, department: "Operations" },
  { name: "Frank Support", email: "frank@staffhub.test", role: Role.STAFF, department: "Support" },
  { name: "Grace QA", email: "grace@staffhub.test", role: Role.STAFF, department: "QA" },
  { name: "Hank Manager", email: "hank@staffhub.test", role: Role.MANAGER, department: "Engineering" },
];

function getAddisNow(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
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
    Number(obj.second),
  );
}

function getWeekdaysInMonth(year: number, month: number): number[] {
  const days: number[] = [];
  const lastDay = new Date(year, month, 0).getDate();
  for (let d = 1; d <= lastDay; d++) {
    const dayOfWeek = new Date(year, month - 1, d).getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) days.push(d);
  }
  return days;
}

function makeDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

async function main() {
  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 12);

  const userIds: string[] = [];

  for (const user of reportTestUsers) {
    const created = await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, department: user.department, password: hashedPassword },
      create: { name: user.name, email: user.email, password: hashedPassword, role: user.role, department: user.department },
    });
    userIds.push(created.id);
    console.log(`  User: ${created.name} (${created.email})`);
  }

  const addisNow = getAddisNow();
  const year = addisNow.getFullYear();
  const month = addisNow.getMonth() + 1;
  const weekdays = getWeekdaysInMonth(year, month);

  if (weekdays.length < 7) {
    console.log(`\n  Only ${weekdays.length} weekdays this month — need at least 7 for a good test. Skipping records.`);
    return;
  }

  await prisma.attendanceRecord.deleteMany({
    where: {
      userId: { in: userIds },
      date: { gte: makeDate(year, month, 1), lt: new Date(year, month, 1) },
    },
  });

  const scenarios: { userName: string; presentDays: number[]; absentDays: number[]; leaveDays: number[] }[] = [
    { userName: "Dave Dev", presentDays: weekdays.slice(0, 15), absentDays: [], leaveDays: [] },
    { userName: "Eve Ops", presentDays: weekdays.filter((_, i) => i % 3 !== 0), absentDays: weekdays.filter((_, i) => i % 3 === 0 && i % 6 !== 0), leaveDays: [] },
    { userName: "Frank Support", presentDays: weekdays.filter((_, i) => i < 8), absentDays: weekdays.filter((_, i) => i >= 8 && i < 10), leaveDays: weekdays.filter((_, i) => i >= 10 && i < 12) },
    { userName: "Grace QA", presentDays: weekdays.filter((_, i) => i < 5), absentDays: weekdays.filter((_, i) => i >= 5 && i < 8), leaveDays: weekdays.filter((_, i) => i >= 8 && i < 10) },
    { userName: "Hank Manager", presentDays: weekdays, absentDays: [], leaveDays: [] },
  ];

  let totalRecords = 0;

  for (const scenario of scenarios) {
    const user = reportTestUsers.find((u) => u.name === scenario.userName);
    if (!user) continue;
    const created = await prisma.user.findUnique({ where: { email: user.email } });
    if (!created) continue;

    const records: { userId: string; date: Date; requestedStatus: AttendanceStatus; status: AttendanceStatus; note: string | null }[] = [];

    for (const day of scenario.presentDays) {
      records.push({
        userId: created.id,
        date: makeDate(year, month, day),
        requestedStatus: "PRESENT",
        status: "PRESENT",
        note: null,
      });
    }

    for (const day of scenario.absentDays) {
      records.push({
        userId: created.id,
        date: makeDate(year, month, day),
        requestedStatus: "ABSENT",
        status: "ABSENT",
        note: "Auto-marked: no attendance record by cutoff.",
      });
    }

    for (const day of scenario.leaveDays) {
      const leaveType: AttendanceStatus = day % 2 === 0 ? "ANNUAL_LEAVE" : "PERMISSION";
      records.push({
        userId: created.id,
        date: makeDate(year, month, day),
        requestedStatus: leaveType,
        status: leaveType,
        note: leaveType === "ANNUAL_LEAVE" ? "Annual leave day" : "Permission — personal errand",
      });
    }

    if (records.length > 0) {
      await prisma.attendanceRecord.createMany({ data: records });
      totalRecords += records.length;
    }
  }

  console.log(`\n  Created ${totalRecords} attendance records for ${year}-${String(month).padStart(2, "0")}.\n`);
  console.log("  Breakdown:");
  console.log("    Dave Dev     —  Present: many,  No absences or leave (perfect attendance)");
  console.log("    Eve Ops      —  Present: most,  Absent: a few scattered days");
  console.log("    Frank Support — Present: some,  Absent: 2 days,  Leave: 2 days");
  console.log("    Grace QA     —  Present: few,   Absent: 3 days,  Leave: 2 days (problem case)");
  console.log("    Hank Manager —  Present: all,   No absences or leave (manager)\n");
  console.log("  Run `npm run db:seed-reports-cleanup` to delete all report test data.\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
