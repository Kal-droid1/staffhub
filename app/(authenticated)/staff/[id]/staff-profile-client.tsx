"use client";

import { useState } from "react";
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

interface MonthSummary {
  present: number;
  absent: number;
  leave: number;
  pending: number;
}

interface Props {
  staff: StaffMember;
  balances: Balance[];
  records: RecordRow[];
  grants: GrantRow[];
  monthSummary: MonthSummary;
}

const ROLE_OPTIONS = ["STAFF", "MANAGER", "ADMIN"];

export default function StaffProfileClient({ staff, balances, records, grants, monthSummary }: Props) {
  const router = useRouter();

  const [showEdit, setShowEdit] = useState(false);
  const [editingName, setEditingName] = useState(staff.name);
  const [editingEmail, setEditingEmail] = useState(staff.email);
  const [editingRole, setEditingRole] = useState(staff.role);
  const [editingDepartment, setEditingDepartment] = useState(staff.department ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [actingId, setActingId] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState(false);
  const [hideFromReports, setHideFromReports] = useState(staff.hideFromReports);
  const [showConfirmation, setShowConfirmation] = useState<"deactivate" | "delete" | null>(null);

  const [filterStatus, setFilterStatus] = useState("all");

  const totalRemaining = balances.reduce((sum, b) => sum + b.remaining, 0);
  const maxGranted = Math.max(balances.reduce((sum, b) => sum + b.granted, 0), totalRemaining);
  const todayStr = new Date().toISOString().slice(0, 7);

  const filteredRecords = filterStatus === "all"
    ? records
    : records.filter((r) => r.status === filterStatus);

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
    setDeactivateTarget(false);
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
    if (s === "present" || s === "approved") return "present";
    if (s === "absent" || s === "rejected") return "absent";
    if (s === "pending") return "pending";
    return "leave";
  }

  return (
    <div className="page-container" style={{ maxWidth: 860 }}>
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
            This Month
          </h2>
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
        <div className="card-grid" style={{ marginBottom: "1.25rem" }}>
          {balances.map((b) => {
            const maxVal = Math.max(b.granted, b.remaining + b.used);
            return (
              <Card key={b.leaveTypeId} hover>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.95rem", textAlign: "center" }}>
                    {b.leaveTypeName}
                    {b.isAnnualRecurring && <span className="text-sm text-muted" style={{ marginLeft: "0.35rem" }}>(annual)</span>}
                  </div>
                  <RadialGauge value={b.remaining} max={maxVal} size={120} strokeWidth={9} />
                  <div className="flex-row gap-lg" style={{ justifyContent: "center" }}>
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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <h2 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--color-brand)", margin: 0 }}>
          Request History
        </h2>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="form-select"
          style={{ maxWidth: 160, fontSize: "0.8125rem" }}
        >
          <option value="all">All</option>
          <option value="PRESENT">Present</option>
          <option value="ABSENT">Absent</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="PERMISSION">Permission</option>
          <option value="ANNUAL_LEAVE">Annual Leave</option>
          <option value="OTHER">Other</option>
        </select>
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
              {filteredRecords.map((r) => (
                <tr key={r.id}>
                  <td data-label="Date" style={{ whiteSpace: "nowrap" }}>{new Date(r.date).toLocaleDateString()}</td>
                  <td data-label="Type">
                    {r.leaveTypeName ?? r.requestedStatus}
                  </td>
                  <td data-label="Status" style={{ textAlign: "center" }}>
                    <StatusPill status={getStatusVariant(r.status)} label={r.status} />
                  </td>
                  <td data-label="Note" className="text-muted">{r.note || "—"}</td>
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
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      )}
    </div>
  );
}
