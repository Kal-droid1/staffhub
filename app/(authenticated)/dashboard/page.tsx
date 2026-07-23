import { ROLE_HIERARCHY } from "@/modules/core/roles";
import { requireAuth } from "@/modules/core/require-auth";
import type { Role } from "@prisma/client";

function getRoleLabel(role: Role): string {
  if (ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.ADMIN) return "Admin";
  if (ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.MANAGER) return "Manager";
  return "Staff";
}

export default async function DashboardPage() {
  const user = await requireAuth();
  const roleLabel = getRoleLabel(user.role);

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 1rem" }}>
      <h1>{roleLabel} Dashboard</h1>
      <p>Welcome, {user.name} ({user.email}).</p>
      <p>Your role: <strong>{user.role}</strong></p>
      {user.department && <p>Department: {user.department}</p>}
    </div>
  );
}
