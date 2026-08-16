import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";
import { normalizeEmail } from "@/lib/email";

export interface SessionUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  department: string | null;
  jobTitleName: string | null;
  avatarUrl: string | null;
  isHidden: boolean;
  isTeacher: boolean;
}

export async function getUserByEmail(email: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: { id: true, name: true, username: true, email: true, role: true, department: true, avatarUrl: true, isHidden: true, isTeacher: true, jobTitle: { select: { name: true } } },
  });
  if (!user) return null;
  return { ...user, jobTitleName: user.jobTitle?.name ?? null };
}

export async function getUserById(id: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, username: true, email: true, role: true, department: true, avatarUrl: true, isHidden: true, isTeacher: true, jobTitle: { select: { name: true } } },
  });
  if (!user) return null;
  return { ...user, jobTitleName: user.jobTitle?.name ?? null };
}
