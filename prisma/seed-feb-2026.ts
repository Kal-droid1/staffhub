import { PrismaClient, AttendanceStatus } from "@prisma/client";

const prisma = new PrismaClient();

const existingAccounts = [
  "alice@staffhub.test",
  "bob@staffhub.test",
  "carol@staffhub.test",
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
  leaveDays: { day: number; type: AttendanceStatus; note: string }[];
}

async function main() {
  const weekdays = getWeekdaysInFeb();

  const users = await prisma.user.findMany({
    where: { email: { in: existingAccounts } },
  });
  const userMap = new Map(users.map((u) => [u.email, u]));

  for (const email of existingAccounts) {
    if (!userMap.has(email)) {
      console.error(`  ERROR: ${email} not found. Run db:seed first.`);
      process.exit(1);
    }
  }

  const userId = (email: string) => userMap.get(email)!.id;
  const userName = (email: string) => userMap.get(email)!.name;

  const scenarios: Scenario[] = [
    {
      email: "alice@staffhub.test",
      presentDays: weekdays.filter((d) => d <= 23),
      absentDays: [24, 25],
      leaveDays: [
        { day: 26, type: "PERMISSION", note: "Doctor appointment" },
        { day: 27, type: "ANNUAL_LEAVE", note: "Annual leave day" },
      ],
    },
    {
      email: "bob@staffhub.test",
      presentDays: weekdays,
      absentDays: [],
      leaveDays: [],
    },
    {
      email: "carol@staffhub.test",
      presentDays: weekdays.filter((d) => d !== 17 && d !== 26 && d !== 27),
      absentDays: [17],
      leaveDays: [
        { day: 26, type: "OTHER", note: "Conference" },
        { day: 27, type: "OTHER", note: "Conference day 2" },
      ],
    },
  ];

  let total = 0;

  for (const s of scenarios) {
    const id = userId(s.email);
    const records: {
      userId: string;
      date: Date;
      requestedStatus: AttendanceStatus;
      status: AttendanceStatus;
      note: string | null;
    }[] = [];

    for (const day of s.presentDays) {
      records.push({ userId: id, date: makeDate(day), requestedStatus: "PRESENT", status: "PRESENT", note: null });
    }
    for (const day of s.absentDays) {
      records.push({ userId: id, date: makeDate(day), requestedStatus: "ABSENT", status: "ABSENT", note: "Auto-marked: no attendance record by cutoff." });
    }
    for (const ld of s.leaveDays) {
      records.push({ userId: id, date: makeDate(ld.day), requestedStatus: ld.type, status: ld.type, note: ld.note });
    }

    if (records.length > 0) {
      await prisma.attendanceRecord.createMany({ data: records });
    }
    total += records.length;

    const p = s.presentDays.length;
    const a = s.absentDays.length;
    const l = s.leaveDays.length;
    console.log(`  ${userName(s.email).padEnd(12)} - Present: ${String(p).padStart(2)},  Absent: ${a},  Leave: ${l}  (${p + a + l} total)`);
  }

  console.log(`\n  Inserted ${total} records for February ${YEAR} (${weekdays.length} weekdays in month).`);
  console.log(`\n  Expected report (sorted most-absent-first):`);
  console.log(`    Alice Staff  - Present: ${scenarios[0].presentDays.length}, Absent: ${scenarios[0].absentDays.length}, Leave: ${scenarios[0].leaveDays.length}`);
  console.log(`    Carol Admin  - Present: ${scenarios[2].presentDays.length}, Absent: ${scenarios[2].absentDays.length}, Leave: ${scenarios[2].leaveDays.length}`);
  console.log(`    Bob Manager  - Present: ${scenarios[1].presentDays.length}, Absent: ${scenarios[1].absentDays.length}, Leave: ${scenarios[1].leaveDays.length}\n`);
  console.log("  Run `npm run db:seed-feb-2026-cleanup` to delete these records.\n");
  console.log("  (These accounts themselves are NOT deleted - only their Feb 2026 records.)\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
