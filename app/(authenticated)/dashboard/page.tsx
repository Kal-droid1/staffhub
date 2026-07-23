import { ROLE_HIERARCHY } from "@/modules/core/roles";
import { requireAuth } from "@/modules/core/require-auth";
import { getLeaveBalances } from "@/modules/leave/queries";
import type { Role } from "@prisma/client";
import Card from "@/modules/core/components/card";

function getRoleLabel(role: Role): string {
  if (ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.ADMIN) return "Admin";
  if (ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.MANAGER) return "Manager";
  return "Staff";
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const user = await requireAuth();
  const roleLabel = getRoleLabel(user.role);
  const balances = await getLeaveBalances(user.id);
  const greeting = getGreeting();

  const totalRemaining = balances.reduce((sum, b) => sum + b.remaining, 0);
  const lowBalanceCount = balances.filter((b) => b.remaining <= 0).length;

  return (
    <div className="page-container">
      <h1 className="page-title" style={{ marginBottom: "1.5rem" }}>
        {greeting}, {user.name}
      </h1>

      <div className="card-grid card-grid--3" style={{ marginBottom: "1.5rem" }}>
        <Card>
          <p className="stat-label">Your Role</p>
          <p className="stat-number" style={{ fontSize: "1.5rem", marginTop: "0.25rem" }}>
            {roleLabel}
          </p>
          <p className="text-sm text-muted" style={{ marginTop: "0.15rem" }}>
            {user.email}
            {user.department ? ` · ${user.department}` : ""}
          </p>
        </Card>

        <Card>
          <p className="stat-label">Total Leave Remaining</p>
          <p className="stat-number" style={{ marginTop: "0.25rem" }}>
            {totalRemaining.toFixed(1)}
          </p>
          <p className="text-sm text-muted" style={{ marginTop: "0.15rem" }}>
            across all leave types
          </p>
        </Card>

        <Card>
          <p className="stat-label">Low / Zero Balances</p>
          <p
            className="stat-number"
            style={{
              marginTop: "0.25rem",
              color: lowBalanceCount > 0 ? "var(--color-danger)" : "var(--color-accent)",
            }}
          >
            {lowBalanceCount}
          </p>
          <p className="text-sm text-muted" style={{ marginTop: "0.15rem" }}>
            {lowBalanceCount === 0
              ? "All balances healthy"
              : `type${lowBalanceCount !== 1 ? "s" : ""} with no remaining days`}
          </p>
        </Card>
      </div>

      <Card style={{ overflow: "hidden", padding: 0 }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)" }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600, color: "var(--color-brand)" }}>
            Leave Balances
          </h2>
        </div>

        {balances.length === 0 ? (
          <p className="text-muted" style={{ padding: "2rem 1.5rem", margin: 0 }}>
            No leave types configured yet.
          </p>
        ) : (
          <table className="table-card" style={{ boxShadow: "none", border: "none", borderRadius: 0 }}>
            <thead>
              <tr>
                <th>Type</th>
                <th style={{ textAlign: "center" }}>Granted</th>
                <th style={{ textAlign: "center" }}>Used</th>
                <th style={{ textAlign: "center" }}>Remaining</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.leaveTypeId}>
                  <td>
                    {b.leaveTypeName}
                    {b.isAnnualRecurring && (
                      <span className="text-sm text-muted" style={{ marginLeft: "0.35rem" }}>
                        (annual)
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>{b.granted}</td>
                  <td style={{ textAlign: "center" }}>{b.used}</td>
                  <td style={{ textAlign: "center", fontWeight: 600 }}>
                    <span
                      className={
                        b.remaining <= 0
                          ? "status-pill status-pill--danger"
                          : "status-pill status-pill--success"
                      }
                    >
                      {b.remaining}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
