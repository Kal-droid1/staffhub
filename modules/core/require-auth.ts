import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";
import { hasRole } from "./roles";
import type { Role } from "@prisma/client";
import type { SessionUser } from "./user";

export async function requireAuth(requiredRole?: Role): Promise<SessionUser> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (requiredRole && !hasRole(session.user.role as Role, requiredRole)) {
    redirect("/login");
  }

  return session.user as SessionUser;
}
