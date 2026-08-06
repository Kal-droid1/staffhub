import { PrismaClient, AttendanceStatus } from "@prisma/client";

const prisma = new PrismaClient();

const knownEmails = [
  "alice@staffhub.test",
  "bob@staffhub.test",
  "Beka@gmail.com",
  "kal@gmail.com",
];

const YEAR = 2026;
const MONTH = 2;

function makeDate(day: number): Date {
  return new Date(YEAR, MONTH - 1, day);
}

function getWeekdaysInFeb(): number[] {
  const days: number[] = [];
  for (let d = 1; d <= 28; d++) {
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
  const weekdays = getWeekdaysInFeb();

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      deactivatedAt: null,
    },
  });
  const userMap = new Map(users.map((u) => [u.email, u]));

  const leaveType = await prisma.leaveType.findFirst();
  if (!leaveType) {
    console.error("No leave types found. Run db:seed first.");
    process.exit(1);
  }

  for (const email of knownEmails) {
    if (!userMap.has(email)) {
      console.error(`  ERROR: ${email} not found. Run db:seed first.`);
      process.exit(1);
    }
  }

  const scenarios: Scenario[] = [
    {
      email: "alice@staffhub.test",
      presentDays: weekdays.filter((d) => d <= 17),
      absentDays: [18, 23],
      leaveDays: [
        { day: 24, type: "PERMISSION", note: "Doctor appointment", leaveTypeId: leaveType.id },
        { day: 25, type: "ANNUAL_LEAVE", note: "Annual leave", leaveTypeId: leaveType.id },
      ],
      pendingDays: [
        { day: 26, type: "PERMISSION", note: "Pending - personal" },
      ],
    },
    {
      email: "bob@staffhub.test",
      presentDays: weekdays.filter((d) => d !== 10 && d !== 20),
      absentDays: [20],
      leaveDays: [
        { day: 10, type: "PERMISSION", note: "Personal day", leaveTypeId: leaveType.id },
      ],
      pendingDays: [],
    },
    {
      email: "Beka@gmail.com",
      presentDays: weekdays.filter((d) => d !== 5 && d !== 13 && d !== 19),
      absentDays: [5, 19],
      leaveDays: [
        { day: 13, type: "ANNUAL_LEAVE", note: "Short trip", leaveTypeId: leaveType.id },
      ],
      pendingDays: [],
    },
    {
      email: "kal@gmail.com",
      presentDays: weekdays.filter((d) => d !== 9 && d !== 16 && d !== 27),
      absentDays: [9],
      leaveDays: [
        { day: 16, type: "PERMISSION", note: "Errand", leaveTypeId: leaveType.id },
      ],
      pendingDays: [
        { day: 27, type: "PERMISSION", note: "Pending - sick note" },
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

  console.log(`\n  Inserted ${total} records for February ${YEAR} (${weekdays.length} weekdays in month).`);
  console.log("  (This is the exact boundary case — 20 weekdays = template column count.)\n");
  console.log("  Run `npm run db:seed-feb-2026-cleanup` to delete these records.\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
