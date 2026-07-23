import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
}

export async function getUserByEmail(email: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, department: true },
  });
  return user;
}

export async function getUserById(id: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, department: true },
  });
  return user;
}
