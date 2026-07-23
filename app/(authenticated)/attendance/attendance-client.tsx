"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Card from "@/modules/core/components/card";
import StatusPill from "@/modules/core/components/status-pill";
import PersonRow from "@/modules/core/components/person-row";
import RadialGauge from "@/modules/core/components/radial-gauge";

interface TodayRecord {
  id: string;
  signInTime: string | null;
  requestedStatus: string;
  note: string | null;
  status: string;
  date: string;
  reviewedBy: { id: string; name: string } | null;
}

interface PendingRecord {
  id: string;
  date: string;
  signInTime: string | null;
  requestedStatus: string;
  leaveTypeId: string | null;
  note: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    department: string | null;
  };
}

interface Balance {
  leaveTypeId: string;
  leaveTypeName: string;
  isAnnualRecurring: boolean;
  granted: number;
  used: number;
  remaining: number;
}

interface LeaveType {
  id: string;
  name: string;
  mappedStatus: string;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  department: string | null;
}

interface SummaryRow {
  userName: string;
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  pendingCount: number;
}

interface Props {
  userRole: string;
  currentUserId: string;
  todayRecord: TodayRecord | null;
  cutoffTime: string;
  initialSecondsUntil: number;
  leaveTypes: LeaveType[];
  pendingRecords: PendingRecord[];
  balances: Record<string, Balance[]>;
  ownBalances: Balance[];
}

function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getStatusVariant(status: string): "present" | "absent" | "pending" | "leave" {
  const s = status.toLowerCase();
  if (s === "present" || s === "approved") return "present";
  if (s === "absent" || s === "rejected") return "absent";
  if (s === "pending") return "pending";
  return "leave";
}

const isManager = (role: string) => role === "MANAGER" || role === "ADMIN";

function getCurrentMonthDefault(): { month: number; year: number } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
  });
  const [year, month] = formatter.format(now).split("-").map(Number);
  return { month, year };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function AttendanceClient({
  userRole,
  currentUserId,
  todayRecord,
  cutoffTime,
  initialSecondsUntil,
  leaveTypes,
  pendingRecords,
  balances,
  ownBalances,
}: Props) {
  const router = useRouter();
  const [record, setRecord] = useState<TodayRecord | null>(todayRecord);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveType, setLeaveType] = useState(leaveTypes[0]?.mappedStatus ?? "PERMISSION");
  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.id ?? "");
  const [leaveNote, setLeaveNote] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(initialSecondsUntil);

  const [pending, setPending] = useState<PendingRecord[]>(pendingRecords);
  const [approveLoadingId, setApproveLoadingId] = useState<string | null>(null);

  const [cutoff, setCutoff] = useState(cutoffTime);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);

  const defaultMonth = getCurrentMonthDefault();
  const [reportMonth, setReportMonth] = useState(defaultMonth.month);
  const [reportYear, setReportYear] = useState(defaultMonth.year);
  const [reportStaffId, setReportStaffId] = useState("");
  const [reportSummary, setReportSummary] = useState<SummaryRow[]>([]);
  const [reportStaff, setReportStaff] = useState<StaffMember[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportLoaded, setReportLoaded] = useState(false);
  const [reportError, setReportError] = useState("");

  const cutoffPassed = secondsLeft <= 0;

  const totalOwnRemaining = ownBalances.reduce((sum, b) => sum + b.remaining, 0);
  const maxOwnGranted = Math.max(ownBalances.reduce((sum, b) => sum + b.granted, 0), totalOwnRemaining, 1);

  useEffect(() => {
    if (record) return;
    if (secondsLeft <= 0) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [record, secondsLeft]);

  async function handleSignIn() {
    setLoading(true);
    setError("");
    setShowLeaveForm(false);

    const res = await fetch("/api/attendance/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "signin" }),
    });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 409 && data.record) {
        setRecord(data.record);
        setError("Already recorded today.");
      } else {
        setError(data.error || "Something went wrong.");
      }
    } else {
      setRecord(data.record);
    }
    setLoading(false);
    router.refresh();
  }

  async function handleLeaveRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/attendance/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "leave",
        requestedStatus: leaveType,
        leaveTypeId: leaveTypeId,
        note: leaveNote || undefined,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 409 && data.record) {
        setRecord(data.record);
        setError("Already recorded today.");
      } else {
        setError(data.error || "Something went wrong.");
      }
    } else {
      setRecord(data.record);
    }
    setLoading(false);
    router.refresh();
  }

  async function handleApproveAction(recordId: string, action: "approve" | "reject") {
    setApproveLoadingId(recordId);
    const res = await fetch("/api/attendance/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordId, action }),
    });
    if (res.ok) {
      setPending((prev) => prev.filter((r) => r.id !== recordId));
    }
    setApproveLoadingId(null);
    router.refresh();
  }

  async function handleSettingsSave(e: React.FormEvent) {
    e.preventDefault();
    setSettingsError("");
    setSettingsSuccess("");
    setSettingsLoading(true);

    const res = await fetch("/api/attendance/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cutoffTime: cutoff }),
    });
    const data = await res.json();

    if (!res.ok) {
      setSettingsError(data.error || "Failed to update.");
    } else {
      setCutoff(data.cutoffTime);
      setSettingsSuccess("Settings updated.");
      router.refresh();
    }
    setSettingsLoading(false);
  }

  function getLeaveTypeName(leaveTypeId: string | null): string | null {
    if (!leaveTypeId) return null;
    return leaveTypes.find((t) => t.id === leaveTypeId)?.name ?? null;
  }

  function getBalanceWarning(r: PendingRecord): string | null {
    if (!r.leaveTypeId) return null;
    const userBalances = balances[r.user.id];
    if (!userBalances) return null;
    const matching = userBalances.find((b) => b.leaveTypeId === r.leaveTypeId);
    if (!matching) return null;
    if (matching.remaining <= 0) {
      return `Balance would be negative (remaining: ${matching.remaining} day${matching.remaining !== 1 ? "s" : ""})`;
    }
    return null;
  }

  const fetchReport = useCallback(async () => {
    setReportLoading(true);
    setReportError("");
    setReportStaffId("");

    const params = new URLSearchParams();
    params.set("month", String(reportMonth));
    params.set("year", String(reportYear));

    const res = await fetch(`/api/reports/monthly?${params.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      setReportError(data.error || "Failed to load report.");
      setReportLoading(false);
      return;
    }

    setReportSummary(data.summary);
    setReportStaff(data.staff);
    setReportLoaded(true);
    setReportLoading(false);
  }, [reportMonth, reportYear]);

  const staffMap: Record<string, string> = {};
  for (const s of reportStaff) {
    staffMap[s.id] = s.name;
  }

  const filteredSummary = reportStaffId
    ? reportSummary.filter((s) => s.userName === staffMap[reportStaffId])
    : reportSummary;

  const xlsxUrl = `/api/reports/monthly?month=${reportMonth}&year=${reportYear}&format=xlsx${reportStaffId ? `&userId=${reportStaffId}` : ""}`;

  function renderAttendance() {
    if (record) {
      const recordStatus = getStatusVariant(record.status);

      return (
        <Card>
          <p className="mb-2" style={{ fontWeight: 500 }}>
            You have already recorded your attendance for today.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <div className="flex-row">
              <span className="text-muted text-sm" style={{ minWidth: 110 }}>
                Date
              </span>
              <span style={{ fontWeight: 500 }}>
                {new Date(record.date).toLocaleDateString()}
              </span>
            </div>
            {record.signInTime && (
              <div className="flex-row">
                <span className="text-muted text-sm" style={{ minWidth: 110 }}>
                  Sign-in time
                </span>
                <span style={{ fontWeight: 500 }}>
                  {new Date(record.signInTime).toLocaleTimeString()}
                </span>
              </div>
            )}
            <div className="flex-row">
              <span className="text-muted text-sm" style={{ minWidth: 110 }}>
                Requested
              </span>
              <span style={{ fontWeight: 500 }}>{record.requestedStatus}</span>
            </div>
            {record.note && (
              <div className="flex-row">
                <span className="text-muted text-sm" style={{ minWidth: 110 }}>
                  Note
                </span>
                <span>{record.note}</span>
              </div>
            )}
            <div className="flex-row">
              <span className="text-muted text-sm" style={{ minWidth: 110 }}>
                Status
              </span>
              <StatusPill status={recordStatus} label={record.status} />
            </div>
            {record.reviewedBy && (
              <div className="flex-row">
                <span className="text-muted text-sm" style={{ minWidth: 110 }}>
                  Reviewed by
                </span>
                <PersonRow name={record.reviewedBy.name} size="sm" />
              </div>
            )}
          </div>
        </Card>
      );
    }

    return (
      <Card>
        <p className="mb-2" style={{ fontWeight: 500 }}>
          You haven&apos;t recorded your attendance today.
        </p>

        {!cutoffPassed && (
          <p className="mb-2" style={{ fontSize: "1.1rem", fontWeight: 500, color: "var(--color-accent)" }}>
            Sign-in closes in {formatCountdown(secondsLeft)}
          </p>
        )}

        {cutoffPassed && (
          <p className="mb-2 form-error" style={{ fontWeight: 500 }}>
            Sign-in closed for today (cutoff was {cutoffTime}). Use Request leave if needed.
          </p>
        )}

        <div className="flex-row gap-md mt-2">
          {!cutoffPassed && (
            <button
              onClick={handleSignIn}
              disabled={loading}
              className="btn btn-success"
            >
              {loading && !showLeaveForm ? "Signing in..." : "Sign in"}
            </button>
          )}

          <button
            onClick={() => setShowLeaveForm(!showLeaveForm)}
            disabled={loading}
            className={showLeaveForm ? "btn btn-ghost" : "btn btn-primary"}
          >
            Request leave
          </button>
        </div>

        {showLeaveForm && (
          <Card
            style={{ marginTop: "1rem", padding: "1.25rem", border: "1px solid var(--color-border)" }}
          >
            <form onSubmit={handleLeaveRequest}>
              <div style={{ marginBottom: "1rem" }}>
                <label className="form-label">Leave type</label>
                <select
                  value={leaveTypeId}
                  onChange={(e) => {
                    const selected = leaveTypes.find((lt) => lt.id === e.target.value);
                    if (selected) {
                      setLeaveTypeId(selected.id);
                      setLeaveType(selected.mappedStatus);
                    }
                  }}
                  className="form-select"
                >
                  {leaveTypes.map((lt) => (
                    <option key={lt.id} value={lt.id}>
                      {lt.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label className="form-label">Note (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={leaveNote}
                  onChange={(e) => setLeaveNote(e.target.value)}
                  placeholder="Reason for leave..."
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? "Submitting..." : "Submit request"}
              </button>
            </form>
          </Card>
        )}

        {error && <p className="form-error mt-2">{error}</p>}
      </Card>
    );
  }

  if (!isManager(userRole)) {
    return (
      <div className="page-container" style={{ maxWidth: 520 }}>
        <h1 className="page-title">Attendance</h1>
        {renderAttendance()}
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1 className="page-title">Operations</h1>

      <div className="card-grid" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--color-brand)", margin: "0 0 0.75rem" }}>
            Attendance
          </h2>
          {renderAttendance()}
        </div>

        <div>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--color-brand)", margin: "0 0 0.75rem" }}>
            Settings
          </h2>
          <Card>
            <form onSubmit={handleSettingsSave}>
              <div style={{ marginBottom: "1rem" }}>
                <label htmlFor="cutoffTime" className="form-label">
                  Daily sign-in cutoff time (24-hour format)
                </label>
                <input
                  id="cutoffTime"
                  type="text"
                  className="form-input"
                  value={cutoff}
                  onChange={(e) => setCutoff(e.target.value)}
                  placeholder="09:00"
                />
                <p className="form-hint">
                  The daily auto-absent check runs at 11:00 AM Addis Ababa time.
                  Cutoff must be no later than 10:30.
                </p>
              </div>

              {settingsError && <p className="form-error mb-1">{settingsError}</p>}
              {settingsSuccess && <p className="form-success mb-1">{settingsSuccess}</p>}

              <button type="submit" disabled={settingsLoading} className="btn btn-primary">
                {settingsLoading ? "Saving..." : "Save"}
              </button>
            </form>
          </Card>
        </div>

        <div>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--color-brand)", margin: "0 0 0.75rem" }}>
            Your Leave
          </h2>
          <Card hover>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
              <RadialGauge
                value={totalOwnRemaining}
                max={maxOwnGranted}
                size={130}
                strokeWidth={10}
                label="Remaining"
              />
              {ownBalances.length > 0 && (
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
                  {ownBalances.slice(0, 3).map((b) => (
                    <div key={b.leaveTypeId} style={{ textAlign: "center" }}>
                      <div className="text-sm text-muted">{b.leaveTypeName}</div>
                      <div style={{ fontWeight: 600, color: b.remaining <= 0 ? "var(--color-danger)" : "var(--color-success)" }}>
                        {b.remaining}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <h2 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--color-brand)", margin: "0 0 0.75rem" }}>
        Pending Approvals
      </h2>

      {pending.length === 0 ? (
        <Card>
          <p className="text-muted text-center" style={{ padding: "1.5rem 0", margin: 0 }}>
            No pending attendance records.
          </p>
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table className="table-card" style={{ boxShadow: "none", border: "none", borderRadius: 0 }}>
            <thead>
              <tr>
                <th>Staff</th>
                <th>Date</th>
                <th>Requested</th>
                <th>Sign-in</th>
                <th>Note</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => {
                const warning = getBalanceWarning(r);
                const displayStatus = r.leaveTypeId
                  ? getLeaveTypeName(r.leaveTypeId) ?? r.requestedStatus
                  : r.requestedStatus;
                return (
                  <tr key={r.id}>
                    <td>
                      <PersonRow
                        name={r.user.name}
                        department={r.user.department ?? undefined}
                        size="sm"
                      />
                    </td>
                    <td>{new Date(r.date).toLocaleDateString()}</td>
                    <td>
                      <StatusPill
                        status={r.requestedStatus.toLowerCase() === "present" ? "present" : "pending"}
                        label={displayStatus}
                      />
                    </td>
                    <td>
                      {r.signInTime
                        ? new Date(r.signInTime).toLocaleTimeString()
                        : "\u2014"}
                    </td>
                    <td className="text-muted">{r.note || "\u2014"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {warning && (
                        <div className="mb-1">
                          <span className="status-pill status-pill--danger" style={{ fontSize: "0.7rem" }}>
                            {warning}
                          </span>
                        </div>
                      )}
                      <div className="flex-row gap-sm">
                        <button
                          onClick={() => handleApproveAction(r.id, "approve")}
                          disabled={approveLoadingId === r.id}
                          className="btn btn-success btn-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleApproveAction(r.id, "reject")}
                          disabled={approveLoadingId === r.id}
                          className="btn btn-danger btn-sm"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <h2 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--color-brand)", margin: "2rem 0 0.75rem" }}>
        Monthly Attendance Report
      </h2>

      <Card style={{ marginBottom: "1.25rem" }}>
        <div className="flex-row gap-lg flex-wrap">
          <div>
            <label className="form-label">Month</label>
            <select
              value={reportMonth}
              onChange={(e) => { setReportMonth(Number(e.target.value)); setReportLoaded(false); }}
              className="form-select"
              style={{ minWidth: 150 }}
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={i + 1} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Year</label>
            <select
              value={reportYear}
              onChange={(e) => { setReportYear(Number(e.target.value)); setReportLoaded(false); }}
              className="form-select"
              style={{ minWidth: 110 }}
            >
              {Array.from({ length: 6 }, (_, i) => reportYear - 2 + i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {reportLoaded && reportStaff.length > 0 && (
            <div>
              <label className="form-label">Staff (optional)</label>
              <select
                value={reportStaffId}
                onChange={(e) => setReportStaffId(e.target.value)}
                className="form-select"
                style={{ minWidth: 180 }}
              >
                <option value="">All staff</option>
                {reportStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex-row gap-md mt-2">
          <button
            onClick={fetchReport}
            disabled={reportLoading}
            className="btn btn-primary"
          >
            {reportLoading ? "Loading..." : "View Report"}
          </button>

          {reportLoaded && (
            <a href={xlsxUrl} className="btn btn-success">
              Download report
            </a>
          )}
        </div>
      </Card>

      {reportError && (
        <p className="form-error mb-2">{reportError}</p>
      )}

      {reportLoaded && filteredSummary.length === 0 && !reportLoading && (
        <Card>
          <p className="text-muted text-center" style={{ padding: "1rem 0", margin: 0 }}>
            No attendance records for this month.
          </p>
        </Card>
      )}

      {reportLoaded && filteredSummary.length > 0 && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table className="table-card" style={{ boxShadow: "none", border: "none", borderRadius: 0 }}>
            <thead>
              <tr>
                <th>Staff</th>
                <th style={{ textAlign: "center" }}>Present</th>
                <th style={{ textAlign: "center" }}>Absent</th>
                <th style={{ textAlign: "center" }}>Leave</th>
                <th style={{ textAlign: "center" }}>Pending</th>
              </tr>
            </thead>
            <tbody>
              {filteredSummary.map((row) => (
                <tr key={row.userName}>
                  <td style={{ fontWeight: 600 }}>{row.userName}</td>
                  <td style={{ textAlign: "center" }}>
                    {row.presentCount > 0 ? (
                      <StatusPill status="present" label={String(row.presentCount)} />
                    ) : (
                      row.presentCount
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {row.absentCount > 0 ? (
                      <StatusPill status="absent" label={String(row.absentCount)} />
                    ) : (
                      row.absentCount
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {row.leaveCount > 0 ? (
                      <StatusPill status="leave" label={String(row.leaveCount)} />
                    ) : (
                      row.leaveCount
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {row.pendingCount > 0 ? (
                      <StatusPill status="pending" label={String(row.pendingCount)} />
                    ) : (
                      row.pendingCount
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
