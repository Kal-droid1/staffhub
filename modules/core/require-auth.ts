import { redirect } from "next/navigation";
import { hasRole } from "./roles";
import type { Role } from "@prisma/client";
import type { SessionUser } from "./user";
import { getValidSession } from "./session";

export async function requireAuth(requiredRole?: Role): Promise<SessionUser> {
  const session = await getValidSession();

  if (!session?.user) {
    redirect(
      session?.invalidReason
        ? `/login?reason=${encodeURIComponent(session.invalidReason)}`
        : "/login"
    );
  }

  if (requiredRole && !hasRole(session.user.role as Role, requiredRole)) {
    redirect("/login");
  }

  return session.user as SessionUser;
}
