import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  department: true,
  jobTitleId: true,
  jobTitle: { select: { id: true, name: true } },
  isActive: true,
  hideFromReports: true,
  deactivatedAt: true,
  deletedAt: true,
  createdAt: true,
};

const userSelectSerialized = {
  id: true,
  name: true,
  email: true,
  role: true,
  department: true,
  jobTitleId: true,
  jobTitle: { select: { id: true, name: true } },
  isActive: true,
  hideFromReports: true,
  deactivatedAt: true,
  deletedAt: true,
  createdAt: true,
};

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  jobTitleId: string | null;
  jobTitle: { id: string; name: string } | null;
  isActive: boolean;
  hideFromReports: boolean;
  deactivatedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export async function getAllStaff(): Promise<StaffRow[]> {
  const rows = await prisma.user.findMany({
    where: { deletedAt: null },
    select: userSelect,
    orderBy: { name: "asc" },
  });
  return rows as unknown as StaffRow[];
}

export async function getTrashedStaff(): Promise<StaffRow[]> {
  const rows = await prisma.user.findMany({
    where: { deletedAt: { not: null } },
    select: userSelect,
    orderBy: { deletedAt: "desc" },
  });
  return rows as unknown as StaffRow[];
}

export async function createStaffAccount(data: {
  name: string;
  email: string;
  password: string;
  role: string;
  department?: string;
  jobTitleId?: string | null;
}) {
  const hashed = await bcrypt.hash(data.password, 12);
  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashed,
      role: data.role as "STAFF" | "MANAGER",
      department: data.department || null,
      jobTitleId: data.jobTitleId || null,
    },
    select: userSelect,
  });
}

export async function updateStaffAccount(
  id: string,
  data: {
    name?: string;
    email?: string;
    role?: string;
    department?: string;
    jobTitleId?: string | null;
  }
) {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.department !== undefined) updateData.department = data.department || null;
  if (data.jobTitleId !== undefined) updateData.jobTitleId = data.jobTitleId || null;

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
