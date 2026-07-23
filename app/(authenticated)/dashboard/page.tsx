import { ROLE_HIERARCHY } from "@/modules/core/roles";
import { requireAuth } from "@/modules/core/require-auth";
import { getLeaveBalances } from "@/modules/leave/queries";
import type { Role } from "@prisma/client";

function getRoleLabel(role: Role): string {
  if (ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.ADMIN) return "Admin";
  if (ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.MANAGER) return "Manager";
  return "Staff";
}

export default async function DashboardPage() {
  const user = await requireAuth();
  const roleLabel = getRoleLabel(user.role);
  const balances = await getLeaveBalances(user.id);

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 1rem" }}>
      <h1>{roleLabel} Dashboard</h1>
      <p>Welcome, {user.name} ({user.email}).</p>
      <p>Your role: <strong>{user.role}</strong></p>
      {user.department && <p>Department: {user.department}</p>}

      <h2 style={{ marginTop: "2rem", borderTop: "1px solid #e5e7eb", paddingTop: "1rem" }}>
        Leave Balances
      </h2>

      {balances.length === 0 ? (
        <p style={{ color: "#6b7280" }}>No leave types configured yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.5rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
              <th style={{ padding: "0.5rem" }}>Type</th>
              <th style={{ padding: "0.5rem", textAlign: "center" }}>Granted</th>
              <th style={{ padding: "0.5rem", textAlign: "center" }}>Used</th>
              <th style={{ padding: "0.5rem", textAlign: "center" }}>Remaining</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => (
              <tr key={b.leaveTypeId} style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "0.5rem" }}>
                  {b.leaveTypeName}
                  {b.isAnnualRecurring && (
                    <span style={{ fontSize: "0.8rem", color: "#6b7280", marginLeft: "0.25rem" }}>
                      (annual)
                    </span>
                  )}
                </td>
                <td style={{ padding: "0.5rem", textAlign: "center" }}>{b.granted}</td>
                <td style={{ padding: "0.5rem", textAlign: "center" }}>{b.used}</td>
                <td
                  style={{
                    padding: "0.5rem",
                    textAlign: "center",
                    fontWeight: 600,
                    color: b.remaining < 0 ? "#dc2626" : b.remaining === 0 ? "#d97706" : "#16a34a",
                  }}
                >
                  {b.remaining}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
