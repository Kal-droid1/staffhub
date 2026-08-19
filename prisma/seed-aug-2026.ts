import { PrismaClient, AttendanceStatus } from "@prisma/client";

const prisma = new PrismaClient();

const YEAR = 2026;
const MONTH = 8;

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeDate(day: number): Date {
  // Use UTC to avoid timezone-shift issues when Prisma stores @db.Date
  return new Date(Date.UTC(YEAR, MONTH - 1, day));
}

function getWeekdaysInMonth(): number[] {
  const days: number[] = [];
  const lastDay = new Date(Date.UTC(YEAR, MONTH, 0)).getUTCDate();
  for (let d = 1; d <= lastDay; d++) {
    const dow = new Date(Date.UTC(YEAR, MONTH - 1, d)).getUTCDay();
    if (dow !== 0 && dow !== 6) days.push(d);
  }
  return days;
}

// ── Deterministic pseudo-random ──────────────────────────────────────────────

function seededRandom(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// ── Staff attendance ─────────────────────────────────────────────────────────

/**
 * Per-staff attendance profiles. Each profile controls how often someone is
 * present / absent / on leave / pending.  All randomness is deterministic
 * (seeded) so re-running the script produces identical data.
 */
interface StaffProfile {
  name: string;
  presentPct: number;       // fraction of weekdays they are present
  absentWeight: number;     // relative weight for absent (vs leave)
  leaveWeight: number;      // relative weight for leave (vs absent)
  pendingFraction: number;  // fraction of leave days that are PENDING
}

const STAFF_PROFILES: StaffProfile[] = [
  // ── Managers ──
  { name: "Bob Manager",       presentPct: 0.90, absentWeight: 1, leaveWeight: 1, pendingFraction: 0.0 },
  { name: "Nitsuhwork Aragaw", presentPct: 0.85, absentWeight: 1, leaveWeight: 2, pendingFraction: 0.20 },

  // ── Teachers (non-teaching staff duties) ──
  { name: "Belachew Seifu",    presentPct: 0.82, absentWeight: 1, leaveWeight: 1, pendingFraction: 0.15 },
  { name: "Dagim Medmem",      presentPct: 0.78, absentWeight: 1, leaveWeight: 1, pendingFraction: 0.20 },
  { name: "Fekede Kifle",      presentPct: 0.92, absentWeight: 1, leaveWeight: 1, pendingFraction: 0.0 },
  { name: "Kassahun Alemayhu", presentPct: 0.70, absentWeight: 2, leaveWeight: 1, pendingFraction: 0.25 },
  { name: "Mikyas Mdmem",      presentPct: 0.75, absentWeight: 1, leaveWeight: 2, pendingFraction: 0.30 },
  { name: "Temesgen Wantamo",  presentPct: 0.88, absentWeight: 1, leaveWeight: 1, pendingFraction: 0.10 },
  { name: "Tewolde Kifle",     presentPct: 0.80, absentWeight: 1, leaveWeight: 2, pendingFraction: 0.20 },

  // ── Non-teaching staff ──
  { name: "Bereket Tsehay",    presentPct: 0.76, absentWeight: 2, leaveWeight: 1, pendingFraction: 0.25 },
  { name: "Mahider Getu",      presentPct: 0.95, absentWeight: 1, leaveWeight: 1, pendingFraction: 0.0 },
];

async function seedStaffAttendance(weekdays: number[]) {
  const users = await prisma.user.findMany({
    where: { deletedAt: null, deactivatedAt: null },
    select: { id: true, name: true },
  });
  const userMap = new Map(users.map((u) => [u.name, u]));

  const leaveType = await prisma.leaveType.findFirst();
  if (!leaveType) {
    console.error("  ERROR: No leave types found. Run db:seed first.");
    process.exit(1);
  }

  const rng = seededRandom(2026_08_01);
  let total = 0;

  for (const profile of STAFF_PROFILES) {
    const user = userMap.get(profile.name);
    if (!user) {
      console.log(`  SKIP: "${profile.name}" not found in database.`);
      continue;
    }

    // Partition weekdays → present / non-present
    const shuffled = [...weekdays].sort(() => rng() - 0.5);
    const presentCount = Math.round(weekdays.length * profile.presentPct);
    const presentDays = new Set(shuffled.slice(0, presentCount));
    const nonPresent = shuffled.slice(presentCount);

    // Split non-present into absent vs leave using weighted random
    const totalWeight = profile.absentWeight + profile.leaveWeight;
    const absentCount = Math.round(nonPresent.length * (profile.absentWeight / totalWeight));
    const absentDays = new Set(nonPresent.slice(0, absentCount));
    const leaveCandidates = nonPresent.slice(absentCount);

    // Some leave days become PENDING
    const pendingCount = Math.round(leaveCandidates.length * profile.pendingFraction);
    const pendingDays = new Set(leaveCandidates.slice(0, pendingCount));

    const records: {
      userId: string;
      date: Date;
      requestedStatus: AttendanceStatus;
      status: AttendanceStatus;
      note: string | null;
      leaveTypeId: string | null;
    }[] = [];

    for (const day of weekdays) {
      if (presentDays.has(day)) {
        records.push({
          userId: user.id, date: makeDate(day),
          requestedStatus: "PRESENT", status: "PRESENT",
          note: null, leaveTypeId: null,
        });
      } else if (absentDays.has(day)) {
        records.push({
          userId: user.id, date: makeDate(day),
          requestedStatus: "ABSENT", status: "ABSENT",
          note: "Auto-marked: no attendance record by cutoff.",
          leaveTypeId: null,
        });
      }
    }

    for (const day of leaveCandidates) {
      const isAnnual = day % 3 !== 0;
      const isPending = pendingDays.has(day);
      const status: AttendanceStatus = isPending
        ? "PENDING"
        : isAnnual ? "ANNUAL_LEAVE" : "PERMISSION";
      const note = isPending
        ? (isAnnual ? "Pending approval — annual leave" : "Pending approval — permission")
        : (isAnnual ? "Annual leave" : "Permission — personal errand");

      records.push({
        userId: user.id, date: makeDate(day),
        requestedStatus: isAnnual ? "ANNUAL_LEAVE" : "PERMISSION",
        status, note, leaveTypeId: leaveType.id,
      });
    }

    if (records.length > 0) {
      await prisma.attendanceRecord.createMany({ data: records, skipDuplicates: true });
    }
    total += records.length;

    const p = presentDays.size;
    const a = absentDays.size;
    const l = leaveCandidates.length - pendingCount;
    const pd = pendingCount;
    console.log(`  ${user.name.padEnd(20)} — Present: ${String(p).padStart(2)},  Absent: ${a},  Leave: ${l},  Pending: ${pd}`);
  }

  console.log(`\n  Staff: inserted ${total} records for August ${YEAR} (${weekdays.length} weekdays).\n`);
}

// ── Sunday School attendance ─────────────────────────────────────────────────

async function seedSundaySchoolAttendance() {
  const classes = await prisma.sundaySchoolClass.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      teacherId: true,
      participants: {
        select: { participant: { select: { id: true, name: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  if (classes.length === 0) {
    console.log("  No Sunday School classes found. Skipping.\n");
    return;
  }

  let total = 0;

  for (const cls of classes) {
    const participants = cls.participants.map((cp) => cp.participant);
    if (participants.length === 0) continue;

    let classPresent = 0;
    let classAbsent = 0;

    for (let week = 1; week <= 5; week++) {
      const records: {
        participantId: string;
        classId: string;
        year: number;
        month: number;
        week: number;
        present: boolean;
        submittedAt: Date;
        submittedById: string;
      }[] = [];

      const submittedAt = new Date(Date.UTC(YEAR, MONTH - 1, week * 7 + 1, 10, 30, 0));

      for (const p of participants) {
        const seed = simpleHash(`${p.id}-aug-${week}`);
        const pRng = seededRandom(seed);

        // Base present probability 70–85 %
        const baseProb = 0.70 + pRng() * 0.15;
        // Week 3 slightly lower (holiday effect), week 4 a touch lower
        const weekMod = week === 3 ? -0.10 : week === 4 ? -0.05 : 0;
        const presentProb = Math.max(0.30, Math.min(0.95, baseProb + weekMod));

        // Week 5: 15 % chance record is missing (simulates incomplete submission)
        if (week === 5 && pRng() < 0.15) continue;

        const present = pRng() < presentProb;
        if (present) classPresent++; else classAbsent++;

        records.push({
          participantId: p.id,
          classId: cls.id,
          year: YEAR,
          month: MONTH,
          week,
          present,
          submittedAt,
          submittedById: cls.teacherId,
        });
      }

      if (records.length > 0) {
        await prisma.sundaySchoolAttendance.createMany({ data: records, skipDuplicates: true });
      }
      total += records.length;
    }

    const totalK = classPresent + classAbsent;
    const pRate = totalK > 0 ? ((classPresent / totalK) * 100).toFixed(0) : "0";
    console.log(`  ${cls.name.padEnd(20)} — ${participants.length} kids, present ≈ ${pRate}%`);
  }

  console.log(`\n  Sunday School: inserted ${total} records across ${classes.length} classes for August ${YEAR}.\n`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const weekdays = getWeekdaysInMonth();
  console.log(`\n  Seeding August ${YEAR} attendance data (${weekdays.length} weekdays).\n`);

  console.log("  ── Staff Monthly Attendance ──");
  await seedStaffAttendance(weekdays);

  console.log("  ── Sunday School Attendance ──");
  await seedSundaySchoolAttendance();

  console.log("  ✅ Done! Inspect the reports for August 2026.\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
