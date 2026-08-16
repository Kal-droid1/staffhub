import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { visibleUserWhere } from "@/lib/visibility";
import { normalizeUsername, isValidUsername } from "@/lib/username";

const userSelect = {
  id: true,
  name: true,
  username: true,
  email: true,
  role: true,
  department: true,
  jobTitleId: true,
  jobTitle: { select: { id: true, name: true } },
  avatarUrl: true,
  isActive: true,
  hideFromReports: true,
  isTeacher: true,
  deactivatedAt: true,
  deletedAt: true,
  createdAt: true,
};

const userSelectSerialized = {
  id: true,
  name: true,
  username: true,
  email: true,
  role: true,
  department: true,
  jobTitleId: true,
  jobTitle: { select: { id: true, name: true } },
  avatarUrl: true,
  isActive: true,
  hideFromReports: true,
  isTeacher: true,
  deactivatedAt: true,
  deletedAt: true,
  createdAt: true,
};

export interface StaffRow {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  department: string | null;
  jobTitleId: string | null;
  jobTitle: { id: string; name: string } | null;
  avatarUrl: string | null;
  isActive: boolean;
  hideFromReports: boolean;
  isTeacher: boolean;
  deactivatedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

const teacherOnlyWhere: Prisma.UserWhereInput = {
  isTeacher: true,
  jobTitleId: null,
  role: { notIn: ["MANAGER", "ADMIN"] },
};

export async function getAllStaff(viewerIsHidden = false): Promise<StaffRow[]> {
  const rows = await prisma.user.findMany({
    where: {
      deletedAt: null,
      ...visibleUserWhere(viewerIsHidden),
      NOT: teacherOnlyWhere,
    },
    select: userSelect,
    orderBy: { name: "asc" },
  });
  return rows as unknown as StaffRow[];
}

export async function getTeacherOnlyStaff(viewerIsHidden = false): Promise<StaffRow[]> {
  const rows = await prisma.user.findMany({
    where: {
      deletedAt: null,
      ...visibleUserWhere(viewerIsHidden),
      ...teacherOnlyWhere,
    },
    select: userSelect,
    orderBy: { name: "asc" },
  });
  return rows as unknown as StaffRow[];
}

export async function getTrashedStaff(viewerIsHidden = false): Promise<StaffRow[]> {
  const rows = await prisma.user.findMany({
    where: { deletedAt: { not: null }, ...visibleUserWhere(viewerIsHidden) },
    select: userSelect,
    orderBy: { deletedAt: "desc" },
  });
  return rows as unknown as StaffRow[];
}

export async function createStaffAccount(data: {
  name: string;
  username: string;
  password: string;
  role: string;
  department?: string;
  jobTitleId?: string | null;
  isTeacher?: boolean;
}) {
  if (!isValidUsername(data.username)) {
    throw new Error("Username must be at least 3 characters.");
  }
  const username = normalizeUsername(data.username);
  const hashed = await bcrypt.hash(data.password, 12);
  return prisma.user.create({
    data: {
      name: data.name,
      username,
      // The email column is retained for now but is no longer used for
      // login; derive a placeholder so the NOT NULL + unique constraints hold.
      email: `${username}@staffhub.local`,
      password: hashed,
      role: data.role as "STAFF" | "MANAGER",
      department: data.department || null,
      jobTitleId: data.jobTitleId || null,
      isTeacher: data.isTeacher === true,
    },
    select: userSelect,
  });
}

export async function updateStaffAccount(
  id: string,
  data: {
    name?: string;
    username?: string;
    role?: string;
    department?: string;
    jobTitleId?: string | null;
    isTeacher?: boolean;
  }
) {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.username !== undefined) {
    if (!isValidUsername(data.username)) {
      throw new Error("Username must be at least 3 characters.");
    }
    updateData.username = normalizeUsername(data.username);
  }
  if (data.role !== undefined) updateData.role = data.role;
  if (data.department !== undefined) updateData.department = data.department || null;
  if (data.jobTitleId !== undefined) updateData.jobTitleId = data.jobTitleId || null;
  if (data.isTeacher !== undefined) updateData.isTeacher = data.isTeacher === true;

  return prisma.user.update({
    where: { id },
    data: updateData,
    select: userSelect,
  });
}

export async function deactivateUser(id: string, hideFromReports: boolean) {
  return prisma.user.update({
    where: { id },
    data: { isActive: false, hideFromReports, deactivatedAt: new Date() },
    select: userSelect,
  });
}

export async function resetUserPassword(id: string, newPassword: string) {
  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id },
    data: { password: hashed },
  });
  return { success: true };
}

export async function reactivateUser(id: string) {
  return prisma.user.update({
    where: { id },
    data: { isActive: true, hideFromReports: false, deactivatedAt: null },
    select: userSelect,
  });
}

export async function deleteUser(id: string) {
  return prisma.user.update({
    where: { id },
    data: { isActive: false, hideFromReports: true, deletedAt: new Date() },
    select: userSelect,
  });
}

export async function restoreUser(id: string) {
  return prisma.user.update({
    where: { id },
    data: { isActive: true, hideFromReports: false, deactivatedAt: null, deletedAt: null },
    select: userSelect,
  });
}

export async function permanentlyDeleteUser(id: string) {
  await prisma.attendanceRecord.deleteMany({ where: { userId: id } });
  await prisma.leaveGrant.deleteMany({ where: { userId: id } });
  return prisma.user.delete({ where: { id } });
}
