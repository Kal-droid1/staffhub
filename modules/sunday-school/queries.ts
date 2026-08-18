import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getCurrentSundaySchoolPeriod, sundaySchoolPeriodIndex } from "./export-months";

export interface RosterParticipant {
  participantId: string;
  localParticipantId: string;
  name: string;
  gradeLevel: string | null;
  present: boolean | null;
}

export interface ClassRoster {
  classInfo: { id: string; name: string } | null;
  year: number;
  month: number;
  week: number;
  roster: RosterParticipant[];
  submittedAt: string | null;
  submittedByName: string | null;
}

export async function isUserTeacher(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isTeacher: true },
  });
  return user?.isTeacher === true;
}

export async function listTeachers() {
  return prisma.user.findMany({
    where: { isTeacher: true, deletedAt: null, isActive: true },
    select: { id: true, name: true, username: true },
    orderBy: { name: "asc" },
  });
}

export async function listMyClasses(teacherId: string) {
  return prisma.sundaySchoolClass.findMany({
    where: { teacherId, deletedAt: null },
    select: {
      id: true,
      name: true,
      teacherId: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getClassRosterForTeacher(args: {
  teacherId: string;
  classId: string;
  year: number;
  month: number;
  week: number;
}): Promise<ClassRoster> {
  const classInfo = await prisma.sundaySchoolClass.findFirst({
    where: { id: args.classId, deletedAt: null },
    select: { id: true, name: true },
  });

  if (!classInfo || !(await canAccessClassForWeek(args.teacherId, args.classId, args.year, args.month, args.week))) {
    return { classInfo: null, year: args.year, month: args.month, week: args.week, roster: [], submittedAt: null, submittedByName: null };
  }

  const assignments = await prisma.sundaySchoolClassParticipant.findMany({
    where: { classId: classInfo.id },
    select: {
      participant: {
        select: {
          id: true,
          localParticipantId: true,
          name: true,
          gradeLevel: true,
        },
      },
    },
    orderBy: { participant: { name: "asc" } },
  });

  const participantIds = assignments.map((a) => a.participant.id);

  if (participantIds.length === 0) {
    return { classInfo, year: args.year, month: args.month, week: args.week, roster: [], submittedAt: null, submittedByName: null };
  }

  const records = await prisma.sundaySchoolAttendance.findMany({
    where: {
      participantId: { in: participantIds },
      year: args.year,
      month: args.month,
      week: args.week,
    },
    select: { participantId: true, present: true, submittedAt: true, submittedBy: { select: { name: true } } },
  });

  const presentByParticipant = new Map(
    records
      .filter((r) => r.present !== null && r.submittedAt !== null)
      .map((r) => [r.participantId, r.present as boolean])
  );

  let latestRecord: (typeof records)[number] | null = null;
  for (const r of records) {
    if (!r.submittedAt) continue;
    if (!latestRecord || r.submittedAt.getTime() > latestRecord.submittedAt!.getTime()) {
      latestRecord = r;
    }
  }
  const submittedAt = latestRecord?.submittedAt ? latestRecord.submittedAt.toISOString() : null;
  const submittedByName = latestRecord?.submittedBy?.name ?? null;

  const roster = assignments.map((a) => ({
    participantId: a.participant.id,
    localParticipantId: a.participant.localParticipantId,
    name: a.participant.name,
    gradeLevel: a.participant.gradeLevel,
    present: presentByParticipant.get(a.participant.id) ?? null,
  }));

  return { classInfo, year: args.year, month: args.month, week: args.week, roster, submittedAt, submittedByName };
}

export async function submitClassAttendance(args: {
  teacherId: string;
  classId: string;
  year: number;
  month: number;
  week: number;
  records: { participantId: string; present: boolean }[];
}): Promise<{ updated: number; invalidParticipantIds: string[]; missingCount: number; submittedAt: string | null }> {
  const classInfo = await prisma.sundaySchoolClass.findFirst({
    where: { id: args.classId, deletedAt: null },
    select: { id: true },
  });

  if (!classInfo || !(await canAccessClassForWeek(args.teacherId, args.classId, args.year, args.month, args.week))) {
    return { updated: 0, invalidParticipantIds: [], missingCount: 0, submittedAt: null };
  }

  const assignments = await prisma.sundaySchoolClassParticipant.findMany({
    where: { classId: classInfo.id },
    select: { participantId: true },
  });

  const assignedIds = new Set(assignments.map((a) => a.participantId));
  const seenIds = new Set<string>();
  const validRecords = args.records.filter((r) => {
    if (!assignedIds.has(r.participantId) || seenIds.has(r.participantId)) return false;
    seenIds.add(r.participantId);
    return true;
  });
  const invalidParticipantIds = args.records
    .filter((r) => !assignedIds.has(r.participantId))
    .map((r) => r.participantId);

  if (validRecords.length !== assignedIds.size) {
    return {
      updated: 0,
      invalidParticipantIds,
      missingCount: assignedIds.size - validRecords.length,
      submittedAt: null,
    };
  }

  await prisma.$transaction(
    validRecords.map((r) => {
      const submittedAt = new Date();
      return prisma.sundaySchoolAttendance.upsert({
        where: {
          participantId_year_month_week: {
            participantId: r.participantId,
            year: args.year,
            month: args.month,
            week: args.week,
          },
        },
        update: { present: r.present, classId: classInfo.id, submittedAt, submittedById: args.teacherId },
        create: {
          participantId: r.participantId,
          classId: classInfo.id,
          year: args.year,
          month: args.month,
          week: args.week,
          present: r.present,
          submittedAt,
          submittedById: args.teacherId,
        },
      });
    })
  );

  const submittedAt = validRecords.length > 0 ? new Date().toISOString() : null;
  return { updated: validRecords.length, invalidParticipantIds, missingCount: 0, submittedAt };
}

export async function listClasses() {
  return prisma.sundaySchoolClass.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      teacherId: true,
      teacher: { select: { id: true, name: true } },
      participants: {
        select: {
          participant: {
            select: {
              id: true,
              localParticipantId: true,
              name: true,
              gradeLevel: true,
            },
          },
        },
        orderBy: { participant: { name: "asc" } },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function createClass(args: {
  name: string;
  teacherId: string;
  participantIds: string[];
}) {
  const teacher = await prisma.user.findUnique({
    where: { id: args.teacherId },
    select: { id: true, isTeacher: true },
  });
  if (!teacher) throw new Error("Teacher not found");
  if (!teacher.isTeacher) throw new Error("Selected user is not flagged as a teacher");

  const participants = await prisma.participant.findMany({
    where: { id: { in: args.participantIds } },
    select: { id: true },
  });
  const foundIds = new Set(participants.map((p) => p.id));
  const missingIds = args.participantIds.filter((id) => !foundIds.has(id));
  if (missingIds.length > 0) {
    throw new Error(`Participants not found: ${missingIds.join(", ")}`);
  }

  const classRecord = await prisma.sundaySchoolClass.create({
    data: {
      name: args.name.trim(),
      teacherId: args.teacherId,
    },
    select: {
      id: true,
      name: true,
      teacherId: true,
    },
  });

  if (args.participantIds.length > 0) {
    await assignParticipantsToClass(classRecord.id, args.participantIds);
  }

  return classRecord;
}

export async function updateClass(args: {
  id: string;
  name?: string;
  teacherId?: string;
  participantIds?: string[];
}) {
  const existing = await prisma.sundaySchoolClass.findUnique({ where: { id: args.id } });
  if (!existing) throw new Error("Class not found");

  if (args.teacherId) {
    const teacher = await prisma.user.findUnique({
      where: { id: args.teacherId },
      select: { id: true, isTeacher: true },
    });
    if (!teacher) throw new Error("Teacher not found");
    if (!teacher.isTeacher) throw new Error("Selected user is not flagged as a teacher");
  }

  if (args.participantIds) {
    const participants = await prisma.participant.findMany({
      where: { id: { in: args.participantIds } },
      select: { id: true },
    });
    const foundIds = new Set(participants.map((p) => p.id));
    const missingIds = args.participantIds.filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      throw new Error(`Participants not found: ${missingIds.join(", ")}`);
    }
  }

  const data: Record<string, unknown> = {};
  if (args.name !== undefined) data.name = args.name.trim();
  if (args.teacherId !== undefined) data.teacherId = args.teacherId;

  if (args.participantIds) {
    const participantIds = args.participantIds;
    await prisma.$transaction(async (tx) => {
      await tx.sundaySchoolClassParticipant.deleteMany({
        where: { classId: args.id, participantId: { notIn: participantIds } },
      });
      await assignParticipantsToClass(args.id, participantIds, tx);
    });
  }

  return prisma.sundaySchoolClass.update({
    where: { id: args.id },
    data,
    select: {
      id: true,
      name: true,
      teacherId: true,
    },
  });
}

async function assignParticipantsToClass(
  classId: string,
  participantIds: string[],
  tx: Prisma.TransactionClient = prisma
) {
  for (const participantId of participantIds) {
    await tx.sundaySchoolClassParticipant.upsert({
      where: { participantId },
      update: { classId },
      create: { participantId, classId },
    });
  }
}

export async function deleteClass(id: string) {
  const existing = await prisma.sundaySchoolClass.findUnique({ where: { id } });
  if (!existing) throw new Error("Class not found");

  await prisma.$transaction(async (tx) => {
    await tx.sundaySchoolClassParticipant.deleteMany({ where: { classId: id } });
    await tx.sundaySchoolClass.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  });
}

export async function restoreClass(id: string) {
  const existing = await prisma.sundaySchoolClass.findUnique({ where: { id } });
  if (!existing) throw new Error("Class not found");

  return prisma.sundaySchoolClass.update({
    where: { id },
    data: { deletedAt: null },
    select: { id: true, name: true, teacherId: true },
  });
}

export async function permanentlyDeleteClass(id: string) {
  const existing = await prisma.sundaySchoolClass.findUnique({ where: { id } });
  if (!existing) throw new Error("Class not found");

  await prisma.sundaySchoolAttendance.updateMany({
    where: { classId: id },
    data: { classId: null },
  });

  await prisma.sundaySchoolClassParticipant.deleteMany({ where: { classId: id } });

  await prisma.sundaySchoolClass.delete({ where: { id } });
}

export async function listTrashedClasses() {
  return prisma.sundaySchoolClass.findMany({
    where: { deletedAt: { not: null } },
    select: {
      id: true,
      name: true,
      teacher: { select: { id: true, name: true } },
      deletedAt: true,
    },
    orderBy: { deletedAt: "desc" },
  });
}

export async function getSundaySchoolAttendanceForExport(args: { year: number; month: number }) {
  const records = await prisma.sundaySchoolAttendance.findMany({
    where: { year: args.year, month: args.month },
    select: {
      participantId: true,
      participant: {
        select: { localParticipantId: true, name: true },
      },
      week: true,
      present: true,
    },
    orderBy: [{ participant: { name: "asc" } }, { week: "asc" }],
  });

  const byParticipant = new Map<
    string,
    {
      participantId: string;
      localParticipantId: string;
      name: string;
      weeks: { present: boolean; hasRecord: boolean }[];
    }
  >();

  for (const r of records) {
    if (r.present === null) continue;
    let entry = byParticipant.get(r.participantId);
    if (!entry) {
      entry = {
        participantId: r.participantId,
        localParticipantId: r.participant.localParticipantId,
        name: r.participant.name,
        weeks: Array.from({ length: 5 }, () => ({ present: false, hasRecord: false })),
      };
      byParticipant.set(r.participantId, entry);
    }
    if (r.week >= 1 && r.week <= 5) {
      entry.weeks[r.week - 1] = { present: r.present, hasRecord: true };
    }
  }

  return Array.from(byParticipant.values());
}

export interface ClassAttendanceHistoryWeek {
  week: number;
  presentCount: number;
  absentCount: number;
  status: "not_started" | "in_progress" | "submitted";
  submittedAt: string | null;
}

export async function getClassAttendanceHistory(args: {
  classId: string;
  year: number;
  month: number;
}) {
  const classInfo = await prisma.sundaySchoolClass.findFirst({
    where: { id: args.classId, deletedAt: null },
    select: {
      id: true,
      name: true,
      teacher: { select: { id: true, name: true } },
    },
  });
  if (!classInfo) return null;

  // Attendance records are tied to the class (classId) + participant +
  // year/month/week, not to the current teacher, so reassigning a class's
  // teacher never changes what this view shows for past weeks.
  const records = await prisma.sundaySchoolAttendance.findMany({
    where: { classId: classInfo.id, year: args.year, month: args.month },
    select: { week: true, present: true, submittedAt: true },
  });

  const weeks: ClassAttendanceHistoryWeek[] = [];
  for (let week = 1; week <= 5; week++) {
    const weekRecords = records.filter((r) => r.week === week);
    const presentCount = weekRecords.filter((r) => r.present === true).length;
    const absentCount = weekRecords.filter((r) => r.present === false).length;

    let latest: Date | null = null;
    for (const r of weekRecords) {
      if (r.submittedAt && (!latest || r.submittedAt > latest)) latest = r.submittedAt;
    }

    const hasSelection = presentCount + absentCount > 0;
    const status = !hasSelection
      ? ("not_started" as const)
      : latest
        ? ("submitted" as const)
        : ("in_progress" as const);

    weeks.push({
      week,
      presentCount,
      absentCount,
      status,
      submittedAt: latest ? latest.toISOString() : null,
    });
  }

  return {
    classInfo: { id: classInfo.id, name: classInfo.name },
    teacher: classInfo.teacher,
    year: args.year,
    month: args.month,
    weeks,
  };
}

export async function isCoverageSubstituteForWeek(args: {
  userId: string;
  classId: string;
  year: number;
  month: number;
  week: number;
}): Promise<boolean> {
  const week = await prisma.sundaySchoolCoverageWeek.findFirst({
    where: {
      year: args.year,
      month: args.month,
      week: args.week,
      coverage: {
        classId: args.classId,
        substituteId: args.userId,
      },
    },
    select: { id: true },
  });
  return Boolean(week);
}

async function canAccessClassForWeek(
  userId: string,
  classId: string,
  year: number,
  month: number,
  week: number
): Promise<boolean> {
  if (!classId) return false;
  const classInfo = await prisma.sundaySchoolClass.findFirst({
    where: { id: classId, deletedAt: null },
    select: { teacherId: true },
  });
  if (!classInfo) return false;
  if (classInfo.teacherId === userId) return true;
  // Coverage only grants access while the covered week is current or upcoming;
  // once the window passes, it stops having any effect.
  if (!isCoverageWindowActive(year, month, week)) return false;
  return isCoverageSubstituteForWeek({ userId, classId, year, month, week });
}

function isCoverageWindowActive(year: number, month: number, week: number): boolean {
  const current = getCurrentSundaySchoolPeriod();
  return (
    sundaySchoolPeriodIndex(year, month, week) >=
    sundaySchoolPeriodIndex(current.year, current.month, current.week)
  );
}

export async function listCoveredClassesForSubstitute(
  substituteId: string,
  year: number,
  month: number,
  week: number
) {
  if (!isCoverageWindowActive(year, month, week)) return [];

  const rows = await prisma.sundaySchoolCoverageWeek.findMany({
    where: {
      year,
      month,
      week,
      coverage: {
        substituteId,
        class: { deletedAt: null },
      },
    },
    select: {
      coverage: {
        select: {
          class: { select: { id: true, name: true } },
          teacher: { select: { id: true, name: true } },
        },
      },
    },
  });

  const seen = new Set<string>();
  return rows
    .map((r) => ({
      id: r.coverage.class.id,
      name: r.coverage.class.name,
      teacherId: r.coverage.teacher.id,
      teacherName: r.coverage.teacher.name,
    }))
    .filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
}

export async function createCoverage(args: {
  teacherId: string;
  classId: string;
  substituteId: string;
  year: number;
  month: number;
  weeks: number[];
}) {
  const classInfo = await prisma.sundaySchoolClass.findFirst({
    where: { id: args.classId, teacherId: args.teacherId, deletedAt: null },
    select: { id: true },
  });
  if (!classInfo) throw new Error("Class not found");

  if (args.substituteId === args.teacherId) {
    throw new Error("Choose another teacher as the substitute.");
  }

  const substitute = await prisma.user.findFirst({
    where: { id: args.substituteId, isTeacher: true, deletedAt: null, isActive: true },
    select: { id: true },
  });
  if (!substitute) throw new Error("Substitute teacher not found.");

  const weeks = Array.from(new Set(args.weeks)).sort((a, b) => a - b);
  if (weeks.length === 0) {
    throw new Error("Select at least one week.");
  }
  for (const w of weeks) {
    if (!Number.isInteger(w) || w < 1 || w > 5) {
      throw new Error("Invalid week. Weeks must be between 1 and 5.");
    }
  }

  // Coverage only makes sense for the current or upcoming weeks — reject
  // weeks that have already passed so dead arrangements can't be created.
  const current = getCurrentSundaySchoolPeriod();
  const currentIdx = sundaySchoolPeriodIndex(current.year, current.month, current.week);
  const pastWeeks = weeks.filter(
    (w) => sundaySchoolPeriodIndex(args.year, args.month, w) < currentIdx
  );
  if (pastWeeks.length > 0) {
    throw new Error(
      `Coverage can only be arranged for the current or upcoming weeks — week${pastWeeks.length === 1 ? "" : "s"} ${pastWeeks.join(", ")} ${pastWeeks.length === 1 ? "is" : "are"} already past.`
    );
  }

  const coverage = await prisma.$transaction(async (tx) => {
    const created = await tx.sundaySchoolCoverage.create({
      data: {
        classId: args.classId,
        teacherId: args.teacherId,
        substituteId: args.substituteId,
      },
      select: { id: true },
    });

    for (const week of weeks) {
      await tx.sundaySchoolCoverageWeek.create({
        data: {
          coverageId: created.id,
          year: args.year,
          month: args.month,
          week,
        },
        select: { id: true },
      });
    }

    return created;
  });

  return coverage;
}

export async function listMyCoverages(teacherId: string) {
  return prisma.sundaySchoolCoverage.findMany({
    where: { teacherId },
    select: {
      id: true,
      class: { select: { id: true, name: true } },
      substitute: { select: { id: true, name: true } },
      weeks: {
        select: { year: true, month: true, week: true },
        orderBy: [{ year: "asc" }, { month: "asc" }, { week: "asc" }],
      },
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listIncomingCoveragesForSubstitute(substituteId: string) {
  const coverages = await prisma.sundaySchoolCoverage.findMany({
    where: { substituteId, class: { deletedAt: null } },
    select: {
      id: true,
      class: { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true } },
      weeks: {
        select: { year: true, month: true, week: true },
        orderBy: [{ year: "asc" }, { month: "asc" }, { week: "asc" }],
      },
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const current = getCurrentSundaySchoolPeriod();
  const currentIdx = sundaySchoolPeriodIndex(current.year, current.month, current.week);

  return coverages
    .map((c) => ({
      id: c.id,
      class: c.class,
      teacher: c.teacher,
      weeks: c.weeks.filter(
        (w) => sundaySchoolPeriodIndex(w.year, w.month, w.week) >= currentIdx
      ),
    }))
    .filter((c) => c.weeks.length > 0);
}

export async function deleteCoverage(args: { coverageId: string; userId: string }) {
  const coverage = await prisma.sundaySchoolCoverage.findFirst({
    where: {
      id: args.coverageId,
      OR: [{ teacherId: args.userId }, { substituteId: args.userId }],
    },
    select: { id: true },
  });
  if (!coverage) throw new Error("Coverage not found");

  await prisma.sundaySchoolCoverage.delete({ where: { id: coverage.id } });
  return { ok: true };
}

export interface ClassSubmissionStatus {
  classId: string;
  name: string;
  teacherName: string;
  participantCount: number;
  status: "not_started" | "in_progress" | "submitted";
}

/**
 * Per-class submission status for one week, mirroring the status logic used by
 * the teacher's My Class page and the manager's class history view:
 *  - not_started: no selections at all for this week
 *  - in_progress: selections exist but nothing has been submitted
 *  - submitted:   at least one record carries a submittedAt timestamp
 * Classes with no participants are excluded (they can never be submitted).
 */
export async function getSundaySchoolSubmissionSummary(args: {
  year: number;
  month: number;
  week: number;
}): Promise<ClassSubmissionStatus[]> {
  const classes = await prisma.sundaySchoolClass.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      teacher: { select: { name: true } },
      _count: { select: { participants: true } },
    },
    orderBy: { name: "asc" },
  });

  const records = await prisma.sundaySchoolAttendance.findMany({
    where: { year: args.year, month: args.month, week: args.week },
    select: { classId: true, present: true, submittedAt: true },
  });

  const byClass = new Map<string, { hasSelection: boolean; latest: Date | null }>();
  for (const r of records) {
    if (!r.classId) continue;
    let entry = byClass.get(r.classId);
    if (!entry) {
      entry = { hasSelection: false, latest: null };
      byClass.set(r.classId, entry);
    }
    if (r.present !== null) entry.hasSelection = true;
    if (r.submittedAt && (!entry.latest || r.submittedAt > entry.latest)) {
      entry.latest = r.submittedAt;
    }
  }

  return classes
    .filter((c) => c._count.participants > 0)
    .map((c) => {
      const entry = byClass.get(c.id);
      const status = !entry?.hasSelection
        ? ("not_started" as const)
        : entry.latest
          ? ("submitted" as const)
          : ("in_progress" as const);
      return {
        classId: c.id,
        name: c.name,
        teacherName: c.teacher.name,
        participantCount: c._count.participants,
        status,
      };
    });
}

function periodFromIndex(index: number): { year: number; month: number; week: number } {
  const week = ((index - 1) % 5) + 1;
  const monthIndex = Math.floor((index - 1) / 5);
  const year = Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  return { year, month, week };
}

export interface ChronicAbsence {
  participantId: string;
  name: string;
  localParticipantId: string;
  className: string | null;
  absenceCount: number;
}

/**
 * Participants with at least `minAbsences` submitted "Absent" records. The
 * records are counted either within a specific month's weeks (when `year` and
 * `month` are given) or within a rolling window of `windowWeeks` attendance
 * weeks ending at the real current week (Addis time). Only records that were
 * actually submitted count — records with present = null or missing submittedAt
 * are never treated as absences.
 */
export async function getChronicAbsences(args: {
  minAbsences?: number;
  windowWeeks?: number;
  year?: number;
  month?: number;
}): Promise<ChronicAbsence[]> {
  const minAbsences = Math.max(1, Math.floor(args.minAbsences ?? 3));
  const windowWeeks = Math.max(1, Math.min(20, Math.floor(args.windowWeeks ?? 5)));

  const { year, month } = args;
  let periods: { year: number; month: number; week: number }[];
  if (year !== undefined && month !== undefined) {
    periods = [1, 2, 3, 4, 5].map((week) => ({ year, month, week }));
  } else {
    const current = getCurrentSundaySchoolPeriod();
    const currentIdx = sundaySchoolPeriodIndex(current.year, current.month, current.week);
    const startIdx = currentIdx - (windowWeeks - 1);

    periods = [];
    for (let idx = startIdx; idx <= currentIdx; idx++) {
      periods.push(periodFromIndex(idx));
    }
  }

  const records = await prisma.sundaySchoolAttendance.findMany({
    where: {
      present: false,
      submittedAt: { not: null },
      OR: periods.map((p) => ({ year: p.year, month: p.month, week: p.week })),
    },
    select: {
      participantId: true,
      participant: {
        select: {
          name: true,
          localParticipantId: true,
          sundaySchoolClasses: {
            where: { class: { deletedAt: null } },
            select: { class: { select: { name: true } } },
          },
        },
      },
    },
  });

  const byParticipant = new Map<
    string,
    {
      participantId: string;
      name: string;
      localParticipantId: string;
      className: string | null;
      count: number;
    }
  >();

  for (const r of records) {
    let entry = byParticipant.get(r.participantId);
    if (!entry) {
      entry = {
        participantId: r.participantId,
        name: r.participant.name,
        localParticipantId: r.participant.localParticipantId,
        className: r.participant.sundaySchoolClasses[0]?.class.name ?? null,
        count: 0,
      };
      byParticipant.set(r.participantId, entry);
    }
    entry.count += 1;
  }

  return Array.from(byParticipant.values())
    .filter((p) => p.count >= minAbsences)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .map((p) => ({
      participantId: p.participantId,
      name: p.name,
      localParticipantId: p.localParticipantId,
      className: p.className,
      absenceCount: p.count,
    }));
}
