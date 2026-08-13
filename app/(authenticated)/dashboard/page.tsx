import { ROLE_HIERARCHY } from "@/modules/core/roles";
import { requireAuth } from "@/modules/core/require-auth";
import { getLeaveBalances } from "@/modules/leave/queries";
import { countPendingRequestGroups, getTeamAttendanceToday } from "@/modules/attendance/queries";
import type { Role } from "@prisma/client";
import Card from "@/modules/core/components/card";
import { formatDays, formatDaysLabel } from "@/lib/format";
import Link from "next/link";

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

const pillLabelStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.2rem 0.7rem",
  borderRadius: "999px",
  fontSize: "0.7rem",
  fontWeight: 700,
  letterSpacing: "0.03em",
  backgroundColor: "rgba(31,107,77,0.1)",
  color: "#1F6B4D",
  border: "1px solid rgba(31,107,77,0.3)",
  whiteSpace: "nowrap",
};

export default async function DashboardPage() {
  const user = await requireAuth();
  const roleLabel = getRoleLabel(user.role);
  const balances = await getLeaveBalances(user.id);
  const greeting = getGreeting();

  const totalRemaining = balances.reduce((sum, b) => sum + b.remaining, 0);

  const isManager = ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY.MANAGER;
  const pendingApprovals = isManager ? await countPendingRequestGroups() : 0;
  const teamToday = isManager ? await getTeamAttendanceToday() : null;

  return (
    <div className="page-container">
      <h1 className="page-title" style={{ marginBottom: "1.5rem" }}>
        {greeting}, {user.name}
      </h1>

      {isManager && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
          {/* Pending Approvals */}
          <section style={{
            background: "rgba(250, 247, 240, 0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.4)",
            borderTop: "4px solid #D9A441",
            borderRadius: "0.75rem",
            boxShadow: "0 8px 32px rgba(31, 107, 77, 0.08), 0 2px 8px rgba(0,0,0,0.04)",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}>
            <div>
              <h2 style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#1F6B4D",
                fontFamily: "var(--font-mono)",
                margin: "0 0 1rem",
              }}>
                Pending Approvals
              </h2>
              <p style={{ fontSize: "2.75rem", fontWeight: 800, color: "#D9A441", margin: "0 0 0.25rem", lineHeight: 1.1 }}>
                {pendingApprovals}
              </p>
              <p style={{ margin: "0 0 1.5rem", fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                request{pendingApprovals === 1 ? "" : "s"} awaiting review
              </p>
            </div>
            <Link
              href="/attendance"
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "0.6rem 1rem",
                background: "#1F6B4D",
                color: "#fff",
                border: "none",
                borderRadius: "0.5rem",
                fontWeight: 600,
                fontSize: "0.875rem",
                textDecoration: "none",
                boxShadow: "0 2px 8px rgba(31,107,77,0.2)",
                transition: "background 0.15s ease",
              }}
            >
              View Requests
            </Link>
          </section>

          {/* Team Attendance Today */}
          <section style={{
            background: "linear-gradient(135deg, #1F6B4D 0%, #0A261B 100%)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
            color: "#fff",
            position: "relative",
            overflow: "hidden",
            boxShadow: "0 12px 40px rgba(31, 107, 77, 0.2)",
            border: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}>
            <div style={{ position: "absolute", inset: 0, opacity: 0.1, backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "20px 20px", pointerEvents: "none" }} />
            <div style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: "16rem",
              height: "16rem",
              background: "rgba(255,255,255,0.03)",
              borderRadius: "50%",
              filter: "blur(48px)",
              transform: "translate(5rem, -5rem)",
              pointerEvents: "none",
            }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                <h2 style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#D9A441",
                  fontFamily: "var(--font-mono)",
                  margin: 0,
                }}>
                  Team Attendance Today
                </h2>
                <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.7)" }}>Today</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
                <div style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "0.75rem",
                  padding: "1rem",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", marginBottom: "0.5rem", fontFamily: "var(--font-mono)" }}>Present</div>
                  <div style={{ fontSize: "2.5rem", fontWeight: 800, textShadow: "0 0 20px rgba(217,164,65,0.4)" }}>{teamToday?.present ?? 0}</div>
                </div>
                <div style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "0.75rem",
                  padding: "1rem",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", marginBottom: "0.5rem", fontFamily: "var(--font-mono)" }}>Absent</div>
                  <div style={{ fontSize: "2.5rem", fontWeight: 800 }}>{teamToday?.absent ?? 0}</div>
                </div>
                <div style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderTop: "2px solid #D9A441",
                  borderRadius: "0.75rem",
                  padding: "1rem",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", marginBottom: "0.5rem", fontFamily: "var(--font-mono)" }}>On Leave</div>
                  <div style={{ fontSize: "2.5rem", fontWeight: 800, textShadow: "0 0 20px rgba(217,164,65,0.4)" }}>{teamToday?.onLeave ?? 0}</div>
                </div>
                <div style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(217,164,65,0.3)",
                  boxShadow: "0 0 15px rgba(217,164,65,0.1)",
                  borderTop: "2px solid #D9A441",
                  borderRadius: "0.75rem",
                  padding: "1rem",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", marginBottom: "0.5rem", fontFamily: "var(--font-mono)" }}>Pending</div>
                  <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#D9A441", textShadow: "0 0 20px rgba(217,164,65,0.6)" }}>{teamToday?.pending ?? 0}</div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      <div className="card-grid card-grid--2" style={{ marginBottom: "1.5rem" }}>
        <Card>
          <p className="stat-label">Your Role</p>
          <p className="stat-number" style={{ fontSize: "1.5rem", marginTop: "0.25rem" }}>
            {roleLabel}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
              <span style={pillLabelStyle}>Email</span>
              <span style={{ fontWeight: 600, fontSize: "0.875rem", textAlign: "right", wordBreak: "break-word" }}>{user.email}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
              <span style={pillLabelStyle}>
                {user.jobTitleName ? "Job Title" : "Department"}
              </span>
              <span style={{ fontWeight: 600, fontSize: "0.875rem", textAlign: "right" }}>
                {user.jobTitleName || user.department || "\u2014"}
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
            <div>
              <p className="stat-label">Total Leave Remaining</p>
              <p className="stat-number" style={{ marginTop: "0.25rem" }}>
                {formatDaysLabel(totalRemaining)}
              </p>
              <p className="text-sm text-muted" style={{ marginTop: "0.15rem" }}>
                across all leave types
              </p>
            </div>
            <span className="material-symbols-outlined" style={{ fontSize: "1.75rem", color: "#D9A441", opacity: 0.7 }}>
              event_available
            </span>
          </div>

          <div className="table-responsive" style={{ marginTop: "1rem" }}>
            {balances.length === 0 ? (
              <p className="text-muted" style={{ padding: "1.5rem 0", margin: 0 }}>
                No leave types configured yet.
              </p>
            ) : (
              <table className="table-card" style={{ boxShadow: "none", border: "none", borderRadius: 0, width: "100%" }}>
                <thead>
                  <tr style={{ background: "rgba(31,107,77,0.06)" }}>
                    <th style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "#1F6B4D" }}>Type</th>
                    <th style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "#1F6B4D", textAlign: "center" }}>Granted</th>
                    <th style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "#1F6B4D", textAlign: "center" }}>Used</th>
                    <th style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "#1F6B4D", textAlign: "center" }}>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((b) => (
                    <tr key={b.leaveTypeId}>
                      <td data-label="Type">
                        {b.leaveTypeName}
                        {b.isAnnualRecurring && (
                          <span className="text-sm text-muted" style={{ marginLeft: "0.35rem" }}>
                            (annual)
                          </span>
                        )}
                      </td>
                      <td data-label="Granted" style={{ textAlign: "center" }}>{formatDays(b.granted)}</td>
                      <td data-label="Used" style={{ textAlign: "center" }}>{formatDays(b.used)}</td>
                      <td data-label="Remaining" style={{ textAlign: "center", fontWeight: 600 }}>
                        <span
                          className={
                            b.remaining <= 0
                              ? "status-pill status-pill--danger"
                              : "status-pill status-pill--success"
                          }
                        >
                          {formatDays(b.remaining)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>

    </div>
  );
}
