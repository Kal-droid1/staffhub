import { ROLE_HIERARCHY } from "@/modules/core/roles";
import { requireAuth } from "@/modules/core/require-auth";
import { getLeaveBalances } from "@/modules/leave/queries";
import { countPendingRequestGroups, getTeamAttendanceToday, getMyFieldWorkBatches } from "@/modules/attendance/queries";
import type { Role } from "@prisma/client";
import Card from "@/modules/core/components/card";
import StatusPill from "@/modules/core/components/status-pill";
import { formatDays, formatDaysLabel, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
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

function getLeaveTypeIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("annual")) return "flight_takeoff";
  if (lower.includes("sick")) return "medical_services";
  if (lower.includes("parent") || lower.includes("matern") || lower.includes("patern")) return "child_care";
  if (lower.includes("permission")) return "event_note";
  return "event_available";
}

function getFieldWorkApproval(status: string, reviewedById: string | null): "approved" | "rejected" | "pending" {
  if (status === "PENDING") return "pending";
  if (status === "ABSENT") return "rejected";
  if (status === "FIELD_WORK") return reviewedById ? "approved" : "pending";
  return "pending";
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

  const staffRecord = await prisma.user.findUnique({
    where: { id: user.id },
    select: { createdAt: true, jobTitle: { select: { name: true } } },
  });

  const fieldWorkBatches = await getMyFieldWorkBatches(user.id);

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

      {isManager && (
        <div className="card-grid card-grid--2" style={{ marginBottom: "1.5rem" }}>
          <Card style={{ position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ position: "absolute", inset: 0, opacity: 0.08, backgroundImage: "radial-gradient(#1F6B4D 1px, transparent 1px)", backgroundSize: "20px 20px", pointerEvents: "none" }} />
            <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column" }}>
              <p className="stat-label">Your Role</p>
              <p className="stat-number" style={{ fontSize: "1.5rem", marginTop: "0.25rem" }}>
                {roleLabel}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem", flex: 1 }}>
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
                {user.jobTitleName && user.department && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
                    <span style={pillLabelStyle}>Department</span>
                    <span style={{ fontWeight: 600, fontSize: "0.875rem", textAlign: "right" }}>{user.department}</span>
                  </div>
                )}
                {staffRecord?.createdAt && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
                    <span style={pillLabelStyle}>Start Date</span>
                    <span style={{ fontWeight: 600, fontSize: "0.875rem", textAlign: "right" }}>{formatDate(staffRecord.createdAt)}</span>
                  </div>
                )}
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
                    <tr>
                      <th style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "#1F6B4D", background: "rgba(31,107,77,0.06)", borderBottom: "1px solid rgba(31,107,77,0.1)" }}>Type</th>
                      <th style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "#1F6B4D", textAlign: "center", background: "rgba(31,107,77,0.06)", borderBottom: "1px solid rgba(31,107,77,0.1)" }}>Granted</th>
                      <th style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "#1F6B4D", textAlign: "center", background: "rgba(31,107,77,0.06)", borderBottom: "1px solid rgba(31,107,77,0.1)" }}>Used</th>
                      <th style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "#1F6B4D", textAlign: "center", background: "rgba(31,107,77,0.06)", borderBottom: "1px solid rgba(31,107,77,0.1)" }}>Remaining</th>
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
      )}

      {!isManager && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem", maxWidth: "1008px", width: "100%" }}>
          {/* Leave balances */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
              <h2 className="section-label" style={{ color: "#1F6B4D", margin: 0 }}>Your Leave Balances</h2>
              <div style={{ flex: 1, height: 1, background: "var(--color-border-light)" }} />
            </div>

            {balances.length === 0 ? (
              <Card>
                <p className="text-muted" style={{ margin: 0 }}>No leave types configured yet.</p>
              </Card>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 320px))", gap: "1.5rem", justifyContent: "flex-start" }}>
                {balances.map((b) => {
                  const available = Math.max(b.remaining, 0);
                  const total = Math.max(b.granted, 0);
                  const pct = total > 0 ? Math.min(Math.max(Math.round((available / total) * 100), 0), 100) : 0;
                  const isAnnual = b.isAnnualRecurring;
                  return (
                    <Card key={b.leaveTypeId} style={{ position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                      <div style={{
                        position: "absolute",
                        right: "-1rem",
                        top: "-1rem",
                        width: "6rem",
                        height: "6rem",
                        borderRadius: "50%",
                        background: isAnnual ? "rgba(31,107,77,0.08)" : "rgba(217,164,65,0.12)",
                        pointerEvents: "none",
                      }} />
                      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                          <span style={{
                            ...pillLabelStyle,
                            textTransform: "uppercase",
                            backgroundColor: isAnnual ? "rgba(31,107,77,0.1)" : "rgba(217,164,65,0.15)",
                            color: isAnnual ? "#1F6B4D" : "#7d5700",
                            border: `1px solid ${isAnnual ? "rgba(31,107,77,0.3)" : "rgba(217,164,65,0.4)"}`,
                          }}>
                            {b.leaveTypeName}
                          </span>
                          <span className="material-symbols-outlined" style={{ fontSize: "1.5rem", color: isAnnual ? "#1F6B4D" : "#D9A441" }}>
                            {getLeaveTypeIcon(b.leaveTypeName)}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginTop: "0.25rem" }}>
                          <span style={{ fontSize: "2rem", fontWeight: 800, color: "#1F6B4D", lineHeight: 1 }}>{formatDays(available)}</span>
                          <span className="text-muted" style={{ fontSize: "0.875rem" }}>days remaining</span>
                        </div>
                        <div style={{ marginTop: "1.25rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: "0.4rem" }}>
                            <span>{formatDays(available)} Available</span>
                            <span>{formatDays(total)} Total</span>
                          </div>
                          <div style={{ width: "100%", height: "0.4rem", background: "var(--color-border-light)", borderRadius: "999px", overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: isAnnual ? "#1F6B4D" : "#D9A441", borderRadius: "999px" }} />
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* Recent field work */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
              <h2 className="section-label" style={{ color: "#1F6B4D", margin: 0 }}>Recent Field Work</h2>
              <div style={{ flex: 1, height: 1, background: "var(--color-border-light)" }} />
            </div>

            {fieldWorkBatches.length === 0 ? (
              <Card>
                <p className="text-muted" style={{ margin: 0 }}>No field work submitted yet.</p>
              </Card>
            ) : (
              <Card style={{ padding: 0, overflow: "hidden" }}>
                {fieldWorkBatches.map((fw, i) => {
                  const approval = getFieldWorkApproval(fw.status, fw.reviewedById);
                  const label = approval === "approved" ? "Approved" : approval === "rejected" ? "Rejected" : "Pending";
                  return (
                    <div
                      key={fw.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "1rem",
                        padding: "1rem 1.5rem",
                        borderBottom: i === fieldWorkBatches.length - 1 ? "none" : "1px solid var(--color-border-light)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "1rem", minWidth: 0 }}>
                        <div style={{
                          width: "2.75rem",
                          height: "2.75rem",
                          borderRadius: "0.5rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "rgba(31,107,77,0.1)",
                          color: "#1F6B4D",
                          flexShrink: 0,
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "1.25rem" }}>explore</span>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "#1F6B4D", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {fw.note || "Field work"}
                          </p>
                          <p className="text-muted" style={{ margin: "0.2rem 0 0", fontSize: "0.8125rem" }}>{formatDate(fw.date)}</p>
                        </div>
                      </div>
                      <StatusPill status={approval} label={label} />
                    </div>
                  );
                })}
              </Card>
            )}
          </section>

          {/* Bottom profile strip */}
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.75rem 1.5rem",
            background: "rgba(255,255,255,0.8)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.4)",
            borderTop: "3px solid #D9A441",
            borderRadius: "0.75rem",
            boxShadow: "0 8px 32px rgba(31,107,77,0.08)",
            padding: "0.9rem 1.25rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className="section-label" style={{ color: "var(--color-text-muted)", fontSize: "0.65rem" }}>Role</span>
              <span style={pillLabelStyle}>{staffRecord?.jobTitle?.name ?? user.jobTitleName ?? "\u2014"}</span>
            </div>
            <div style={{ width: 1, height: "1.25rem", background: "var(--color-border-light)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className="section-label" style={{ color: "var(--color-text-muted)", fontSize: "0.65rem" }}>Dept</span>
              <span style={pillLabelStyle}>{user.department || "\u2014"}</span>
            </div>
            <div style={{ width: 1, height: "1.25rem", background: "var(--color-border-light)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className="section-label" style={{ color: "var(--color-text-muted)", fontSize: "0.65rem" }}>Tenure</span>
              <span className="text-muted" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                {staffRecord?.createdAt ? `Started ${formatDate(staffRecord.createdAt)}` : "\u2014"}
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
