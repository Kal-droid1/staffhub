"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/modules/core/components/card";
import StatusPill from "@/modules/core/components/status-pill";
import RadialGauge from "@/modules/core/components/radial-gauge";
import { formatDays } from "@/lib/format";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  isActive: boolean;
  hideFromReports: boolean;
  deactivatedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

interface Balance {
  leaveTypeId: string;
  leaveTypeName: string;
  isAnnualRecurring: boolean;
  granted: number;
  used: number;
  remaining: number;
}

interface RecordRow {
  id: string;
  date: string;
  signInTime: string | null;
  requestedStatus: string;
  status: string;
  note: string | null;
  leaveTypeId: string | null;
  leaveTypeName: string | null;
  attachmentUrl: string | null;
  batchId: string | null;
  reviewedBy: { id: string; name: string } | null;
}

interface GrantRow {
  id: string;
  leaveTypeName: string;
  days: number;
  grantedDate: string;
  note: string | null;
  expiresAt: string | null;
}

interface Props {
  staff: StaffMember;
  balances: Balance[];
  records: RecordRow[];
  grants: GrantRow[];
}

const ROLE_OPTIONS = ["STAFF", "MANAGER", "ADMIN"];
const PAGE_SIZE = 12;

const NON_ROUTINE_STATUSES = new Set(["ABSENT", "PENDING", "PERMISSION", "ANNUAL_LEAVE", "OTHER", "FIELD_WORK"]);

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function StaffProfileClient({ staff, balances, records, grants }: Props) {
  const router = useRouter();

  const [showEdit, setShowEdit] = useState(false);
  const [editingName, setEditingName] = useState(staff.name);
  const [editingEmail, setEditingEmail] = useState(staff.email);
  const [editingRole, setEditingRole] = useState(staff.role);
  const [editingDepartment, setEditingDepartment] = useState(staff.department ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [actingId, setActingId] = useState<string | null>(null);
  const [hideFromReports, setHideFromReports] = useState(staff.hideFromReports);
  const [showConfirmation, setShowConfirmation] = useState<"deactivate" | "delete" | null>(null);

  const now = new Date();
  const [summaryMonth, setSummaryMonth] = useState(now.getMonth() + 1);
  const [summaryYear, setSummaryYear] = useState(now.getFullYear());

  const [filterStatus, setFilterStatus] = useState("notable");
  const [page, setPage] = useState(0);

  interface GroupedRecord {
    firstId: string;
    batchId: string | null;
    dateRange: string;
    requestedStatus: string;
    status: string;
    note: string | null;
    leaveTypeId: string | null;
    leaveTypeName: string | null;
    attachmentUrl: string | null;
    reviewedBy: { id: string; name: string } | null;
    count: number;
  }

  const groupedRecords = useMemo((): GroupedRecord[] => {
    const groups = new Map<string | null, RecordRow[]>();
    for (const r of records) {
      const key = r.batchId || r.id;
      const existing = groups.get(key);
      if (existing) {
        existing.push(r);
      } else {
        groups.set(key, [r]);
      }
    }

    const result: GroupedRecord[] = [];
    for (const recs of groups.values()) {
      recs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const first = recs[0];
      const last = recs[recs.length - 1];
      const dateRange = recs.length > 1
        ? `${new Date(first.date).toLocaleDateString()} \u2013 ${new Date(last.date).toLocaleDateString()}`
        : new Date(first.date).toLocaleDateString();

      result.push({
        firstId: first.id,
        batchId: first.batchId,
        dateRange,
        requestedStatus: first.requestedStatus,
        status: first.status,
        note: first.note,
        leaveTypeId: first.leaveTypeId,
        leaveTypeName: first.leaveTypeName,
        attachmentUrl: first.attachmentUrl,
        reviewedBy: first.reviewedBy,
        count: recs.length,
      });
    }
    return result;
  }, [records]);

  const monthSummary = useMemo(() => {
    const start = new Date(summaryYear, summaryMonth - 1, 1);
    const end = new Date(summaryYear, summaryMonth, 1);
    let present = 0, absent = 0, leave = 0, pending = 0;
    for (const r of records) {
      const d = new Date(r.date);
      if (d < start || d >= end) continue;
      switch (r.status) {
        case "PRESENT": case "FIELD_WORK": present++; break;
        case "ABSENT": absent++; break;
        case "PERMISSION": case "ANNUAL_LEAVE": case "OTHER": leave++; break;
        case "PENDING": pending++; break;
      }
    }
    return { present, absent, leave, pending };
  }, [records, summaryMonth, summaryYear]);

  const filteredRecords = useMemo(() => {
    if (filterStatus === "all") return groupedRecords;
    if (filterStatus === "notable") return groupedRecords.filter((r) => NON_ROUTINE_STATUSES.has(r.status));
    return groupedRecords.filter((r) => r.status === filterStatus);
  }, [groupedRecords, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);
  const pagedRecords = filteredRecords.slice(clampedPage * PAGE_SIZE, (clampedPage + 1) * PAGE_SIZE);

  if (clampedPage !== page) {
    setTimeout(() => setPage(clampedPage), 0);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingName.trim() || !editingEmail.trim()) return;
    setSaving(true);
    setError("");

    const res = await fetch("/api/staff", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: staff.id,
        name: editingName.trim(),
        email: editingEmail.trim(),
        role: editingRole,
        department: editingDepartment || undefined,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to update.");
      setSaving(false);
      return;
    }

    setShowEdit(false);
    setSaving(false);
    router.refresh();
  }

  async function handleDeactivate() {
    setActingId(staff.id);
    const res = await fetch("/api/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: staff.id, action: "deactivate", hideFromReports }),
    });
    if (res.ok) router.refresh();
    setActingId(null);
    setShowConfirmation(null);
  }

  async function handleReactivate() {
    setActingId(staff.id);
    const res = await fetch("/api/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: staff.id, action: "reactivate" }),
    });
    if (res.ok) router.refresh();
    setActingId(null);
  }

  async function handleDelete() {
    setActingId(staff.id);
    const res = await fetch("/api/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: staff.id, action: "delete" }),
    });
    if (res.ok) router.push("/staff");
    setActingId(null);
    setShowConfirmation(null);
  }

  function getStatusVariant(status: string): "present" | "absent" | "pending" | "leave" {
    const s = status.toLowerCase();
    if (s === "present" || s === "approved" || s === "field_work") return "present";
    if (s === "absent" || s === "rejected") return "absent";
    if (s === "pending") return "pending";
    return "leave";
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="page-container" style={{ maxWidth: "100%" }}>
      <Link href="/staff" className="btn btn-ghost mb-2">
        ← Back to Staff
      </Link>

      <h1 className="page-title" style={{ marginBottom: "1.25rem" }}>
        {staff.name}
        <span
          style={{
            display: "inline-block",
            padding: "0.15rem 0.5rem",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.75rem",
            fontWeight: 600,
            backgroundColor: staff.role === "ADMIN" ? "var(--color-danger)" : staff.role === "MANAGER" ? "var(--color-accent)" : "var(--color-muted)",
            color: staff.role === "STAFF" ? "var(--color-text)" : "#fff",
            marginLeft: "0.75rem",
            verticalAlign: "middle",
          }}
        >
          {staff.role}
        </span>
        {!staff.isActive && (
          <span
            style={{
              display: "inline-block",
              padding: "0.15rem 0.5rem",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.75rem",
              fontWeight: 600,
              backgroundColor: "var(--color-danger)",
              color: "#fff",
              marginLeft: "0.5rem",
              verticalAlign: "middle",
            }}
          >
            Inactive
          </span>
        )}
      </h1>

      <div className="card-grid card-grid--2" style={{ marginBottom: "1.25rem" }}>
        <Card>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--color-brand)", margin: "0 0 0.75rem" }}>
            Details
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div className="flex-row" style={{ justifyContent: "space-between" }}>
              <span className="text-sm text-muted">Email</span>
              <span style={{ fontWeight: 500 }}>{staff.email}</span>
            </div>
            <div className="flex-row" style={{ justifyContent: "space-between" }}>
              <span className="text-sm text-muted">Department</span>
              <span style={{ fontWeight: 500 }}>{staff.department || "—"}</span>
            </div>
            <div className="flex-row" style={{ justifyContent: "space-between" }}>
              <span className="text-sm text-muted">Status</span>
              <StatusPill
                status={staff.isActive ? "present" : "absent"}
                label={staff.isActive ? "Active" : "Inactive"}
              />
            </div>
            <div className="flex-row" style={{ justifyContent: "space-between" }}>
              <span className="text-sm text-muted">Joined</span>
              <span style={{ fontWeight: 500 }}>{new Date(staff.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex-row gap-sm mt-2">
            {!showEdit && (
              <button onClick={() => setShowEdit(true)} className="btn btn-primary btn-sm">
                Edit
              </button>
            )}
            {staff.isActive ? (
              <>
                <button
                  onClick={() => setShowConfirmation("deactivate")}
                  disabled={actingId === staff.id}
                  className="btn btn-danger btn-sm"
                >
                  Deactivate
                </button>
                <button
                  onClick={() => setShowConfirmation("delete")}
                  disabled={actingId === staff.id}
                  className="btn btn-danger btn-sm"
                >
                  Delete
                </button>
              </>
            ) : (
              <button
                onClick={handleReactivate}
                disabled={actingId === staff.id}
                className="btn btn-success btn-sm"
              >
                Reactivate
              </button>
            )}
          </div>
        </Card>

        <Card>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--color-brand)", margin: "0 0 0.75rem" }}>
            Attendance
          </h2>
          <div className="flex-row gap-sm flex-wrap" style={{ marginBottom: "0.75rem" }}>
            <div>
              <label className="form-label" style={{ fontSize: "0.75rem" }}>Month</label>
              <select value={summaryMonth} onChange={(e) => { setSummaryMonth(Number(e.target.value)); setPage(0); }} className="form-select" style={{ minWidth: 130, fontSize: "0.8125rem" }}>
                {monthOptions.map((m) => (<option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>))}
              </select>
            </div>
            <div>
              <label className="form-label" style={{ fontSize: "0.75rem" }}>Year</label>
              <select value={summaryYear} onChange={(e) => { setSummaryYear(Number(e.target.value)); setPage(0); }} className="form-select" style={{ minWidth: 90, fontSize: "0.8125rem" }}>
                {yearOptions.map((y) => (<option key={y} value={y}>{y}</option>))}
              </select>
            </div>
          </div>
          <div className="flex-row" style={{ justifyContent: "space-around" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-success)" }}>{monthSummary.present}</div>
              <div className="text-sm text-muted">Present</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-danger)" }}>{monthSummary.absent}</div>
              <div className="text-sm text-muted">Absent</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-accent)" }}>{monthSummary.leave}</div>
              <div className="text-sm text-muted">Leave</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-muted)" }}>{monthSummary.pending}</div>
              <div className="text-sm text-muted">Pending</div>
            </div>
          </div>
        </Card>
      </div>

      {showEdit && (
        <Card style={{ marginBottom: "1.25rem" }}>
          <form onSubmit={handleSaveEdit}>
            <h3 style={{ marginTop: 0, color: "var(--color-brand)", fontSize: "1rem" }}>Edit Staff</h3>
            <div style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Name</label>
              <input type="text" className="form-input" value={editingName} onChange={(e) => setEditingName(e.target.value)} required />
            </div>
            <div style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Email</label>
              <input type="email" className="form-input" value={editingEmail} onChange={(e) => setEditingEmail(e.target.value)} required />
            </div>
            <div style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Role</label>
              <select value={editingRole} onChange={(e) => setEditingRole(e.target.value)} className="form-select">
                {ROLE_OPTIONS.map((r) => (<option key={r} value={r}>{r}</option>))}
              </select>
            </div>
            <div style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Department</label>
              <input type="text" className="form-input" value={editingDepartment} onChange={(e) => setEditingDepartment(e.target.value)} />
            </div>
            {error && <p className="form-error mb-1">{error}</p>}
            <div className="flex-row gap-sm">
              <button type="submit" disabled={saving} className="btn btn-success btn-sm">{saving ? "Saving..." : "Save"}</button>
              <button type="button" onClick={() => { setShowEdit(false); setError(""); }} className="btn btn-ghost btn-sm">Cancel</button>
            </div>
          </form>
        </Card>
      )}

      {showConfirmation === "deactivate" && (
        <Card style={{ marginBottom: "1.25rem" }}>
          <p style={{ fontWeight: 500, marginBottom: "0.75rem" }}>Deactivate {staff.name}?</p>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.75rem", fontSize: "0.85rem", cursor: "pointer" }}>
            <input type="checkbox" checked={hideFromReports} onChange={(e) => setHideFromReports(e.target.checked)} />
            Also hide from historical reports?
          </label>
          <div className="flex-row gap-sm">
            <button onClick={handleDeactivate} disabled={actingId === staff.id} className="btn btn-danger btn-sm">Confirm Deactivate</button>
            <button onClick={() => setShowConfirmation(null)} className="btn btn-ghost btn-sm">Cancel</button>
          </div>
        </Card>
      )}

      {showConfirmation === "delete" && (
        <Card style={{ marginBottom: "1.25rem" }}>
          <p style={{ fontWeight: 500, marginBottom: "0.75rem" }}>Delete {staff.name}? This will fully hide them from all reports and move them to Trash.</p>
          <div className="flex-row gap-sm">
            <button onClick={handleDelete} disabled={actingId === staff.id} className="btn btn-danger btn-sm">Confirm Delete</button>
            <button onClick={() => setShowConfirmation(null)} className="btn btn-ghost btn-sm">Cancel</button>
          </div>
        </Card>
      )}

      <h2 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--color-brand)", margin: "0 0 0.75rem" }}>
        Leave Balances
      </h2>

      {balances.length === 0 ? (
        <Card><p className="text-muted text-center" style={{ padding: "1rem 0", margin: 0 }}>No leave types configured.</p></Card>
      ) : (
        <div className="card-grid" style={{ marginBottom: "1.25rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {balances.map((b) => {
            const maxVal = Math.max(b.granted, b.remaining + b.used);
            return (
              <Card key={b.leaveTypeId} hover style={{ padding: "1rem" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", textAlign: "center" }}>
                    {b.leaveTypeName}
                    {b.isAnnualRecurring && <span className="text-sm text-muted" style={{ marginLeft: "0.35rem" }}>(annual)</span>}
                  </div>
                  <RadialGauge value={b.remaining} max={maxVal} size={100} strokeWidth={8} />
                  <div className="flex-row gap-md" style={{ justifyContent: "center" }}>
                    <div style={{ textAlign: "center" }}>
                      <div className="text-sm text-muted">Granted</div>
                      <div style={{ fontWeight: 600 }}>{formatDays(b.granted)}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div className="text-sm text-muted">Used</div>
                      <div style={{ fontWeight: 600 }}>{formatDays(b.used)}</div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h2 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--color-brand)", margin: 0 }}>
          Request History
        </h2>
        <div className="flex-row gap-sm">
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
            className="form-select"
            style={{ maxWidth: 180, fontSize: "0.8125rem" }}
          >
            <option value="notable">Notable events</option>
            <option value="all">All records</option>
            <option value="PRESENT">Present</option>
            <option value="ABSENT">Absent</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="PERMISSION">Permission</option>
            <option value="ANNUAL_LEAVE">Annual Leave</option>
            <option value="OTHER">Other</option>
            <option value="FIELD_WORK">Field Work</option>
          </select>
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <Card><p className="text-muted text-center" style={{ padding: "1rem 0", margin: 0 }}>No records found.</p></Card>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-responsive">
          <table className="table-card" style={{ boxShadow: "none", border: "none", borderRadius: 0 }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th style={{ textAlign: "center" }}>Status</th>
                <th>Note</th>
                <th>Attachment</th>
              </tr>
            </thead>
            <tbody>
              {pagedRecords.map((r) => {
                const displayType = r.requestedStatus === "FIELD_WORK"
                  ? "Field Work"
                  : r.leaveTypeName ?? r.requestedStatus;
                const label = r.count > 1
                  ? `${displayType} (${r.count} days)`
                  : displayType;
                return (
                <tr key={r.firstId}>
                  <td data-label="Date" style={{ whiteSpace: "nowrap" }}>{r.dateRange}</td>
                  <td data-label="Type">{label}</td>
                  <td data-label="Status" style={{ textAlign: "center" }}>
                    <StatusPill status={getStatusVariant(r.status)} label={r.status} />
                  </td>
                  <td data-label="Note" className="text-muted">{r.note || "\u2014"}</td>
                  <td data-label="Attachment">
                    {r.attachmentUrl ? (
                      <div className="flex-row gap-sm">
                        <a
                          href={`/api/attachments?url=${encodeURIComponent(r.attachmentUrl)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-ghost btn-sm"
                        >
                          View
                        </a>
                        <a
                          href={`/api/attachments?url=${encodeURIComponent(r.attachmentUrl)}&download=1`}
                          className="btn btn-ghost btn-sm"
                        >
                          Download
                        </a>
                      </div>
                    ) : (
                      <span className="text-muted">\u2014</span>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {totalPages > 1 && (
            <div className="flex-row" style={{ justifyContent: "center", gap: "0.5rem", padding: "0.75rem", borderTop: "1px solid var(--color-border)" }}>
              <button
                onClick={() => setPage(Math.max(0, clampedPage - 1))}
                disabled={clampedPage === 0}
                className="btn btn-ghost btn-sm"
              >
                ← Prev
              </button>
              <span className="text-sm text-muted">
                Page {clampedPage + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, clampedPage + 1))}
                disabled={clampedPage >= totalPages - 1}
                className="btn btn-ghost btn-sm"
              >
                Next →
              </button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
