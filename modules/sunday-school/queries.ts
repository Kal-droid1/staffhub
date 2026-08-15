import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export interface RosterParticipant {
  participantId: string;
  localParticipantId: string;
  name: string;
  gradeLevel: string | null;
  present: boolean;
}

export interface ClassRoster {
  classInfo: { id: string; name: string } | null;
  year: number;
  month: number;
  week: number;
  roster: RosterParticipant[];
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
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}

export async function listMyClasses(teacherId: string) {
  return prisma.sundaySchoolClass.findMany({
    where: { teacherId },
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
    where: { id: args.classId, teacherId: args.teacherId },
    select: { id: true, name: true },
  });

  if (!classInfo) {
    return { classInfo: null, year: args.year, month: args.month, week: args.week, roster: [] };
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
    return { classInfo, year: args.year, month: args.month, week: args.week, roster: [] };
  }

  const existing = await prisma.sundaySchoolAttendance.findMany({
    where: {
      participantId: { in: participantIds },
      year: args.year,
      month: args.month,
      week: args.week,
    },
    select: { participantId: true },
  });

  const existingIds = new Set(existing.map((r) => r.participantId));
  const missingIds = participantIds.filter((id) => !existingIds.has(id));

  if (missingIds.length > 0) {
    try {
      await prisma.sundaySchoolAttendance.createMany({
        data: missingIds.map((participantId) => ({
          participantId,
          classId: classInfo.id,
          year: args.year,
          month: args.month,
          week: args.week,
          present: true,
        })),
      });
    } catch (e) {
      // Race-safe fallback: another request may have created defaults concurrently.
      if ((e as { code?: string }).code !== "P2002") {
        throw e;
      }
    }
  }

  const records = await prisma.sundaySchoolAttendance.findMany({
    where: {
      participantId: { in: participantIds },
      year: args.year,
      month: args.month,
      week: args.week,
    },
    select: { participantId: true, present: true },
  });

  const presentByParticipant = new Map(records.map((r) => [r.participantId, r.present]));

  const roster = assignments.map((a) => ({
    participantId: a.participant.id,
    localParticipantId: a.participant.localParticipantId,
    name: a.participant.name,
    gradeLevel: a.participant.gradeLevel,
    present: presentByParticipant.get(a.participant.id) ?? true,
  }));

  return { classInfo, year: args.year, month: args.month, week: args.week, roster };
}

export async function submitClassAttendance(args: {
  teacherId: string;
  classId: string;
  year: number;
  month: number;
  week: number;
  records: { participantId: string; present: boolean }[];
}): Promise<{ updated: number; invalidParticipantIds: string[] }> {
  const classInfo = await prisma.sundaySchoolClass.findFirst({
    where: { id: args.classId, teacherId: args.teacherId },
    select: { id: true },
  });

  if (!classInfo) {
    return { updated: 0, invalidParticipantIds: [] };
  }

  const assignments = await prisma.sundaySchoolClassParticipant.findMany({
    where: { classId: classInfo.id },
    select: { participantId: true },
  });

  const assignedIds = new Set(assignments.map((a) => a.participantId));
  const validRecords = args.records.filter((r) => assignedIds.has(r.participantId));
  const invalidParticipantIds = args.records
    .filter((r) => !assignedIds.has(r.participantId))
    .map((r) => r.participantId);

  if (validRecords.length > 0) {
    await prisma.$transaction(
      validRecords.map((r) =>
        prisma.sundaySchoolAttendance.upsert({
          where: {
            participantId_year_month_week: {
              participantId: r.participantId,
              year: args.year,
              month: args.month,
              week: args.week,
            },
          },
          update: { present: r.present, classId: classInfo.id },
          create: {
            participantId: r.participantId,
            classId: classInfo.id,
            year: args.year,
            month: args.month,
            week: args.week,
            present: r.present,
          },
        })
      )
    );
  }

  return { updated: validRecords.length, invalidParticipantIds };
}

export async function listClasses() {
  return prisma.sundaySchoolClass.findMany({
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

  const attendanceCount = await prisma.sundaySchoolAttendance.count({
    where: { classId: id },
  });
  if (attendanceCount > 0) {
    throw new Error(`"${existing.name}" has attendance records and cannot be deleted.`);
  }

  await prisma.sundaySchoolClass.delete({ where: { id } });
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
