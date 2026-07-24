import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  isActive: boolean;
  hideFromReports: boolean;
  deletedAt: string | null;
  createdAt: string;
}

export async function getAllStaff(): Promise<StaffRow[]> {
  const rows = await prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      isActive: true,
      hideFromReports: true,
      deletedAt: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });
  return rows as unknown as StaffRow[];
}

export async function getTrashedStaff(): Promise<StaffRow[]> {
  const rows = await prisma.user.findMany({
    where: { deletedAt: { not: null } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      isActive: true,
      hideFromReports: true,
      deletedAt: true,
      createdAt: true,
    },
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
}) {
  const hashed = await bcrypt.hash(data.password, 12);
  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashed,
      role: data.role as "STAFF" | "MANAGER" | "ADMIN",
      department: data.department || null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      isActive: true,
      hideFromReports: true,
      deletedAt: true,
      createdAt: true,
    },
  });
}

export async function updateStaffAccount(
  id: string,
  data: {
    name?: string;
    email?: string;
    role?: string;
    department?: string;
  }
) {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.department !== undefined) updateData.department = data.department || null;

  return prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      isActive: true,
      hideFromReports: true,
      deletedAt: true,
      createdAt: true,
    },
  });
}

export async function deactivateUser(id: string, hideFromReports: boolean) {
  return prisma.user.update({
    where: { id },
    data: { isActive: false, hideFromReports },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      isActive: true,
      hideFromReports: true,
      deletedAt: true,
      createdAt: true,
    },
  });
}

export async function reactivateUser(id: string) {
  return prisma.user.update({
    where: { id },
    data: { isActive: true, hideFromReports: false },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      isActive: true,
      hideFromReports: true,
      deletedAt: true,
      createdAt: true,
    },
  });
}

export async function deleteUser(id: string) {
  return prisma.user.update({
    where: { id },
    data: { isActive: false, hideFromReports: true, deletedAt: new Date() },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      isActive: true,
      hideFromReports: true,
      deletedAt: true,
      createdAt: true,
    },
  });
}

export async function restoreUser(id: string) {
  return prisma.user.update({
    where: { id },
    data: { isActive: true, hideFromReports: false, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      isActive: true,
      hideFromReports: true,
      deletedAt: true,
      createdAt: true,
    },
  });
}

export async function permanentlyDeleteUser(id: string) {
  await prisma.attendanceRecord.deleteMany({ where: { userId: id } });
  await prisma.leaveGrant.deleteMany({ where: { userId: id } });
  return prisma.user.delete({ where: { id } });
}
