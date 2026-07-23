import { ROLE_HIERARCHY } from "@/modules/core/roles";
import { requireAuth } from "@/modules/core/require-auth";
import type { Role } from "@prisma/client";
import LogoutButton from "./logout-button";
import SessionProvider from "./session-provider";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";

function getRoleLabel(role: Role): string {
  if (ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.ADMIN) return "Admin";
  if (ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.MANAGER) return "Manager";
  return "Staff";
}

export default async function DashboardPage() {
  const user = await requireAuth();
  const session = await getServerSession(authOptions);
  const roleLabel = getRoleLabel(user.role);

  return (
    <SessionProvider session={session}>
      <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1>{roleLabel} Dashboard</h1>
          <LogoutButton />
        </div>
        <p>Welcome, {user.name} ({user.email}).</p>
        <p>Your role: <strong>{user.role}</strong></p>
        {user.department && <p>Department: {user.department}</p>}
      </div>
    </SessionProvider>
  );
}
