import { type Role } from "@prisma/client";
import type { Session } from "next-auth";

export const ROLE_HIERARCHY: Record<Role, number> = {
  STAFF: 1,
  MANAGER: 2,
  ADMIN: 3,
};

export function hasRole(userRole: Role | undefined, requiredRole: Role): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function requireRole(requiredRole: Role) {
  return (session: Session | null): boolean => {
    if (!session?.user?.role) return false;
    return hasRole(session.user.role as Role, requiredRole);
  };
}

export function getServerRole(session: Session | null): Role | null {
  return (session?.user?.role as Role) ?? null;
}
