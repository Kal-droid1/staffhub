import { PrismaClient, AttendanceStatus } from "@prisma/client";

const prisma = new PrismaClient();

const YEAR = 2026;
const MONTH = 7;

function makeDate(day: number): Date {
  return new Date(YEAR, MONTH - 1, day);
}

function getWeekdaysInJuly(): number[] {
  const days: number[] = [];
  for (let d = 1; d <= 31; d++) {
    const dow = new Date(YEAR, MONTH - 1, d).getDay();
    if (dow !== 0 && dow !== 6) days.push(d);
  }
  return days;
}

interface Scenario {
  email: string;
  presentDays: number[];
  absentDays: number[];
  leaveDays: { day: number; type: AttendanceStatus; note: string; leaveTypeId: string }[];
  pendingDays: { day: number; type: AttendanceStatus; note: string }[];
}

async function main() {
  const weekdays = getWeekdaysInJuly();

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      deactivatedAt: null,
    },
    select: { id: true, email: true, name: true },
  });
  const userMap = new Map(users.map((u) => [u.email.toLowerCase(), u]));

  const leaveType = await prisma.leaveType.findFirst();
  if (!leaveType) {
    console.error("No leave types found. Run db:seed first.");
    process.exit(1);
  }

  const knownEmails = [
    "alice@staffhub.test",
    "bob@staffhub.test",
    "beka@gmail.com",
    "kal@gmail.com",
  ];

  for (const email of knownEmails) {
    if (!userMap.has(email.toLowerCase())) {
      console.error(`  ERROR: ${email} not found. Run db:seed first.`);
      process.exit(1);
    }
  }

  const scenarios: Scenario[] = [
    {
      email: "alice@staffhub.test",
      presentDays: weekdays.filter((d) => d !== 3 && d !== 14 && d !== 15 && d !== 25 && d !== 28 && d !== 29 && d !== 30 && d !== 31),
      absentDays: [3, 15],
      leaveDays: [
        { day: 28, type: "PERMISSION", note: "Doctor appointment", leaveTypeId: leaveType.id },
        { day: 29, type: "ANNUAL_LEAVE", note: "Annual leave", leaveTypeId: leaveType.id },
        { day: 30, type: "ANNUAL_LEAVE", note: "Annual leave", leaveTypeId: leaveType.id },
        { day: 31, type: "ANNUAL_LEAVE", note: "Annual leave", leaveTypeId: leaveType.id },
      ],
      pendingDays: [
        { day: 14, type: "PERMISSION", note: "Pending approval - family event" },
      ],
    },
    {
      email: "bob@staffhub.test",
      presentDays: weekdays.filter((d) => d !== 10 && d !== 21 && d !== 22),
      absentDays: [10],
      leaveDays: [
        { day: 21, type: "PERMISSION", note: "Personal day", leaveTypeId: leaveType.id },
        { day: 22, type: "PERMISSION", note: "Personal day", leaveTypeId: leaveType.id },
      ],
      pendingDays: [],
    },
    {
      email: "beka@gmail.com",
      presentDays: weekdays.filter((d) => d !== 8 && d !== 17 && d !== 18 && d !== 24),
      absentDays: [8, 24],
      leaveDays: [
        { day: 17, type: "ANNUAL_LEAVE", note: "Short trip", leaveTypeId: leaveType.id },
        { day: 18, type: "ANNUAL_LEAVE", note: "Short trip", leaveTypeId: leaveType.id },
      ],
      pendingDays: [],
    },
    {
      email: "kal@gmail.com",
      presentDays: weekdays.filter((d) => d !== 7 && d !== 11 && d !== 23),
      absentDays: [11],
      leaveDays: [
        { day: 7, type: "PERMISSION", note: "Personal errand", leaveTypeId: leaveType.id },
      ],
      pendingDays: [
        { day: 23, type: "PERMISSION", note: "Pending - sick note" },
      ],
    },
  ];

  let total = 0;

  for (const s of scenarios) {
    const user = userMap.get(s.email)!;

    const records: {
      userId: string;
      date: Date;
      requestedStatus: AttendanceStatus;
      status: AttendanceStatus;
      note: string | null;
      leaveTypeId: string | null;
    }[] = [];

    for (const day of s.presentDays) {
      records.push({
        userId: user.id,
        date: makeDate(day),
        requestedStatus: "PRESENT",
        status: "PRESENT",
        note: null,
        leaveTypeId: null,
      });
    }
    for (const day of s.absentDays) {
      records.push({
        userId: user.id,
        date: makeDate(day),
        requestedStatus: "ABSENT",
        status: "ABSENT",
        note: "Auto-marked: no attendance record by cutoff.",
        leaveTypeId: null,
      });
    }
    for (const ld of s.leaveDays) {
      records.push({
        userId: user.id,
        date: makeDate(ld.day),
        requestedStatus: ld.type,
        status: ld.type,
        note: ld.note,
        leaveTypeId: ld.leaveTypeId,
      });
    }
    for (const pd of s.pendingDays) {
      records.push({
        userId: user.id,
        date: makeDate(pd.day),
        requestedStatus: pd.type,
        status: "PENDING",
        note: pd.note,
        leaveTypeId: null,
      });
    }

    if (records.length > 0) {
      await prisma.attendanceRecord.createMany({ data: records, skipDuplicates: true });
    }
    total += records.length;

    const p = s.presentDays.length;
    const a = s.absentDays.length;
    const l = s.leaveDays.length;
    const pd = s.pendingDays.length;
    console.log(`  ${user.name.padEnd(14)} - Present: ${String(p).padStart(2)},  Absent: ${a},  Leave: ${l},  Pending: ${pd}  (${p + a + l + pd} total)`);
  }

  console.log(`\n  Inserted ${total} records for July ${YEAR} (${weekdays.length} weekdays in month).\n`);
  console.log("  Run `npm run db:seed-july-2026-cleanup` to delete these records.\n");
  console.log("  (Users themselves are NOT deleted - only their July 2026 attendance records.)\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
