import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function getAllStaff() {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });
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
      createdAt: true,
    },
  });
}

export async function setUserActive(id: string, isActive: boolean) {
  return prisma.user.update({
    where: { id },
    data: { isActive },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      isActive: true,
      createdAt: true,
    },
  });
}
