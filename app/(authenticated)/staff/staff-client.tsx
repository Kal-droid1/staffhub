"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/format";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  jobTitleId: string | null;
  jobTitle: { id: string; name: string } | null;
  avatarUrl: string | null;
  isActive: boolean;
  hideFromReports: boolean;
  deactivatedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

interface JobTitle {
  id: string;
  name: string;
}

interface TrashMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  jobTitle: { id: string; name: string } | null;
  deletedAt: string;
}

interface LeaveTypeOption {
  id: string;
  name: string;
  isAnnualRecurring: boolean;
  mappedStatus: string;
  defaultDays: number;
}

interface Props {
  initialStaff: StaffMember[];
  leaveTypes: LeaveTypeOption[];
}

const PAGE_SIZE = 10;
const ROLE_OVERRIDE_OPTIONS = ["MANAGER"];

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function autoRole(jobTitleName: string | undefined | null): string {
  if (jobTitleName === "Director") return "MANAGER";
  return "STAFF";
}

const ROLE_STYLE: Record<string, { bg: string; text: string; shadow: string }> = {
  STAFF: { bg: "var(--color-muted)", text: "var(--color-text)", shadow: "none" },
  MANAGER: { bg: "#D9A441", text: "#fff", shadow: "0 2px 8px rgba(217,164,65,0.4)" },
};

const AVATAR_BG: Record<string, string> = {
  STAFF: "#6b7b6f",
  MANAGER: "#D9A441",
};

export default function StaffClient({ initialStaff, leaveTypes }: Props) {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitleId, setJobTitleId] = useState("");
  const [grantElevated, setGrantElevated] = useState(false);
  const [overrideRole, setOverrideRole] = useState("MANAGER");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<StaffMember | null>(null);
  const [hideFromReports, setHideFromReports] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [page, setPage] = useState(0);
  const [showTrash, setShowTrash] = useState(false);
  const [trash, setTrash] = useState<TrashMember[] | null>(null);
  const [trashLoading, setTrashLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<TrashMember | null>(null);
  const [deletingPerm, setDeletingPerm] = useState(false);

  const [showBulkGrant, setShowBulkGrant] = useState(false);
  const [bulkTypeId, setBulkTypeId] = useState(leaveTypes[0]?.id ?? "");
  const [bulkDays, setBulkDays] = useState(leaveTypes[0]?.defaultDays ?? 20);
  const [bulkDate, setBulkDate] = useState(adisToday());
  const [bulkNote, setBulkNote] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState("");

  useEffect(() => {
    fetch("/api/job-titles")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setJobTitles(data);
      })
      .catch(() => {});
  }, []);

  const totalPages = Math.max(1, Math.ceil(staff.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);
  const pagedStaff = staff.slice(clampedPage * PAGE_SIZE, (clampedPage + 1) * PAGE_SIZE);
  const showingFrom = staff.length === 0 ? 0 : clampedPage * PAGE_SIZE + 1;
  const showingTo = Math.min((clampedPage + 1) * PAGE_SIZE, staff.length);

  function computedRole(): string {
    if (grantElevated) return overrideRole;
    const jt = jobTitles.find((t) => t.id === jobTitleId);
    return autoRole(jt?.name);
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setName("");
    setEmail("");
    setJobTitleId("");
    setGrantElevated(false);
    setOverrideRole("MANAGER");
    setPassword("");
    setError("");
  }

  function startEdit(s: StaffMember) {
    setEditingId(s.id);
    setName(s.name);
    setEmail(s.email);
    setJobTitleId(s.jobTitleId ?? "");
    setGrantElevated(s.role === "MANAGER");
    setOverrideRole("MANAGER");
    setPassword("");
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    if (!editingId && !password) {
      setError("Password is required for new accounts.");
      return;
    }
    setSaving(true);
    setError("");

    const role = computedRole();
    const isNew = !editingId;
    const payload: Record<string, unknown> = {
      name: name.trim(),
      email: email.trim(),
      role,
      jobTitleId: jobTitleId || null,
    };
    if (isNew) (payload as { password: string }).password = password;
    if (!isNew) payload.id = editingId;

    const res = await fetch("/api/staff", {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to save.");
      setSaving(false);
      return;
    }

    if (isNew) {
      setStaff((prev) => [...prev, data]);
    } else {
      setStaff((prev) => prev.map((s) => (s.id === editingId ? data : s)));
    }

    resetForm();
    setSaving(false);
    router.refresh();
  }

  async function handleDeactivate(id: string) {
    setActingId(id);
    const res = await fetch("/api/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "deactivate", hideFromReports }),
    });
    if (res.ok) {
      const updated = await res.json();
      setStaff((prev) => prev.map((s) => (s.id === id ? updated : s)));
    }
    setActingId(null);
    setDeactivateTarget(null);
    setHideFromReports(false);
    router.refresh();
  }

  async function handleReactivate(id: string) {
    setActingId(id);
    const res = await fetch("/api/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "reactivate" }),
    });
    if (res.ok) {
      const updated = await res.json();
      setStaff((prev) => prev.map((s) => (s.id === id ? updated : s)));
    }
    setActingId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    setActingId(id);
    const res = await fetch("/api/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "delete" }),
    });
    if (res.ok) {
      setStaff((prev) => prev.filter((s) => s.id !== id));
    }
    setActingId(null);
    setDeleteTarget(null);
    router.refresh();
  }

  async function openTrash() {
    setShowTrash(true);
    setTrash(null);
    setTrashLoading(true);
    try {
      const res = await fetch("/api/staff/trash");
      if (res.ok) {
        const data = await res.json();
        setTrash(data);
      }
    } catch {}
    setTrashLoading(false);
  }

  async function handleTrashRestore(id: string) {
    setRestoringId(id);
    const res = await fetch("/api/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "restore" }),
    });
    if (res.ok) {
      setTrash((prev) => prev ? prev.filter((s) => s.id !== id) : null);
      router.refresh();
    }
    setRestoringId(null);
  }

  async function handleTrashPermanentDelete(id: string) {
    setDeletingPerm(true);
    const res = await fetch("/api/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "permanent-delete", confirmation: "DELETE" }),
    });
    if (res.ok) {
      setTrash((prev) => prev ? prev.filter((s) => s.id !== id) : null);
      setPermanentDeleteTarget(null);
    }
    setDeletingPerm(false);
    router.refresh();
  }

  function formatTrashDate(dateStr: string) {
    const d = new Date(dateStr);
    return `${formatDate(d)}, ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
  }

  function openBulkGrant() {
    setBulkTypeId(leaveTypes[0]?.id ?? "");
    setBulkDays(leaveTypes[0]?.defaultDays ?? 20);
    setBulkDate(adisToday());
    setBulkNote("");
    setBulkError("");
    setShowBulkGrant(true);
  }

  async function handleBulkGrant(e: React.FormEvent) {
    e.preventDefault();
    if (bulkDays <= 0 || !bulkTypeId) return;
    setBulkSaving(true);
    setBulkError("");

    const res = await fetch("/api/leave-grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bulk: true,
        leaveTypeId: bulkTypeId,
        days: bulkDays,
        grantedDate: bulkDate,
        note: bulkNote || undefined,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setBulkError(data.error || "Failed to create bulk grants.");
      setBulkSaving(false);
      return;
    }

    setShowBulkGrant(false);
    setBulkSaving(false);
    router.refresh();
  }

  return (
    <>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header area */}
      <div style={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        marginBottom: "1.5rem",
        flexWrap: "wrap",
        gap: "1rem",
      }}>
        <div>
          <h1 style={{
            fontSize: "2rem",
            fontWeight: 800,
            color: "#1F6B4D",
            margin: "0 0 0.35rem",
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
          }}>
            Staff
          </h1>
          <p style={{ margin: 0, fontSize: "0.95rem", color: "var(--color-text-muted)" }}>
            Manage your workforce, roles, and status.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            onClick={openBulkGrant}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.5rem 1rem",
              background: "rgba(255, 255, 255, 0.3)",
              backdropFilter: "blur(8px)",
              border: "1px solid #D9A441",
              borderRadius: "0.5rem",
              color: "#1F6B4D",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
              transition: "background 0.15s",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(217,164,65,0.12)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.3)")}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "1.25rem" }}>group_add</span>
            Grant to All Staff
          </button>
          <button
            onClick={openTrash}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.5rem 1rem",
              background: "rgba(255, 255, 255, 0.3)",
              backdropFilter: "blur(8px)",
              border: "1px solid #1F6B4D",
              borderRadius: "0.5rem",
              color: "#1F6B4D",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
              transition: "background 0.15s",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(31,107,77,0.08)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.3)")}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "1.25rem" }}>delete</span>
            Trash
          </button>
          <button
            onClick={() => setShowForm(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.5rem 1.5rem",
              background: "#1F6B4D",
              color: "#fff",
              border: "none",
              borderRadius: "0.5rem",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
              boxShadow: "0 4px 15px rgba(217,164,65,0.4)",
              transition: "all 0.3s",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#155038";
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(217,164,65,0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#1F6B4D";
              e.currentTarget.style.boxShadow = "0 4px 15px rgba(217,164,65,0.4)";
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "1.25rem" }}>add</span>
            Add Staff
          </button>
        </div>
      </div>

      {/* Modal overlay for Add/Edit form */}
      {showForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0, 0, 0, 0.4)",
              backdropFilter: "blur(4px)",
            }}
            onClick={resetForm}
          />
          <div
            style={{
              position: "relative",
              background: "#FAF7F0",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.4)",
              boxShadow: "0 20px 40px rgba(31, 107, 77, 0.25)",
              borderTop: "4px solid #D9A441",
              maxWidth: 500,
              width: "calc(100% - 2rem)",
              maxHeight: "90vh",
              overflowY: "auto",
              margin: "0 1rem",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, color: "#1F6B4D", fontSize: "1.1rem", fontWeight: 700 }}>
                {editingId ? "Edit Staff" : "New Staff"}
              </h3>
              <button
                onClick={resetForm}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1.5rem",
                  color: "#1F6B4D",
                  lineHeight: 1,
                  padding: "0.25rem",
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: "0.75rem" }}>
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: "0.75rem" }}>
                <label className="form-label">Job Title</label>
                <select
                  value={jobTitleId}
                  onChange={(e) => setJobTitleId(e.target.value)}
                  className="form-select"
                >
                  <option value="">— Select a job title —</option>
                  {jobTitles.map((jt) => (
                    <option key={jt.id} value={jt.id}>
                      {jt.name}
                    </option>
                  ))}
                </select>
                <p className="form-hint" style={{ marginTop: "0.35rem" }}>
                  Role will be set automatically: Director → MANAGER, all others → STAFF
                </p>
              </div>

              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.9rem", fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={grantElevated}
                    onChange={(e) => setGrantElevated(e.target.checked)}
                  />
                  Grant elevated access
                </label>
                {grantElevated && (
                  <div style={{ marginTop: "0.5rem", marginLeft: "1.5rem" }}>
                    <label className="form-label">Override Role</label>
                    <select
                      value={overrideRole}
                      onChange={(e) => setOverrideRole(e.target.value)}
                      className="form-select"
                    >
                      {ROLE_OVERRIDE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {!editingId && (
                <div style={{ marginBottom: "0.75rem" }}>
                  <label className="form-label">Initial Password</label>
                  <input
                    type="text"
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              )}

              {error && <p className="form-error mb-1">{error}</p>}

              <div className="flex-row gap-sm" style={{ marginTop: "0.25rem" }}>
                <button type="submit" disabled={saving} className="btn btn-success">
                  {saving ? "Saving..." : "Save"}
                </button>
                <button type="button" onClick={resetForm} className="btn btn-ghost">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate confirmation modal */}
      {deactivateTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0, 0, 0, 0.4)",
              backdropFilter: "blur(4px)",
            }}
            onClick={() => { setDeactivateTarget(null); setHideFromReports(false); }}
          />
          <div
            style={{
              position: "relative",
              background: "#FAF7F0",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.4)",
              boxShadow: "0 20px 40px rgba(31, 107, 77, 0.25)",
              borderTop: "4px solid #D9A441",
              maxWidth: 440,
              width: "calc(100% - 2rem)",
              margin: "0 1rem",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 style={{ margin: 0, color: "#1F6B4D", fontSize: "1.05rem", fontWeight: 700 }}>Deactivate Staff</h3>
              <button
                onClick={() => { setDeactivateTarget(null); setHideFromReports(false); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.5rem", color: "#1F6B4D", lineHeight: 1, padding: "0.25rem" }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p style={{ margin: "0 0 1rem", fontSize: "0.9rem", color: "var(--color-text)" }}>
              Deactivate <strong>{deactivateTarget.name}</strong>? They will no longer be able to log in until reactivated.
            </p>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "1rem", fontSize: "0.85rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={hideFromReports}
                onChange={(e) => setHideFromReports(e.target.checked)}
              />
              Also hide from historical reports?
            </label>
            <div className="flex-row gap-sm">
              <button
                onClick={() => handleDeactivate(deactivateTarget.id)}
                disabled={actingId === deactivateTarget.id}
                style={{
                  padding: "0.4rem 1rem",
                  background: "#ba1a1a",
                  color: "#fff",
                  border: "none",
                  borderRadius: "0.5rem",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {actingId === deactivateTarget.id ? "Deactivating…" : "Deactivate"}
              </button>
              <button
                onClick={() => { setDeactivateTarget(null); setHideFromReports(false); }}
                style={{
                  padding: "0.4rem 1rem",
                  background: "none",
                  border: "1px solid var(--color-border)",
                  borderRadius: "0.5rem",
                  fontWeight: 500,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  color: "var(--color-text)",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0, 0, 0, 0.4)",
              backdropFilter: "blur(4px)",
            }}
            onClick={() => setDeleteTarget(null)}
          />
          <div
            style={{
              position: "relative",
              background: "#FAF7F0",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.4)",
              boxShadow: "0 20px 40px rgba(31, 107, 77, 0.25)",
              borderTop: "4px solid #ba1a1a",
              maxWidth: 440,
              width: "calc(100% - 2rem)",
              margin: "0 1rem",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 style={{ margin: 0, color: "#ba1a1a", fontSize: "1.05rem", fontWeight: 700 }}>Delete Staff</h3>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.5rem", color: "#1F6B4D", lineHeight: 1, padding: "0.25rem" }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p style={{ margin: "0 0 1rem", fontSize: "0.9rem", color: "var(--color-text)" }}>
              Delete <strong>{deleteTarget.name}</strong>? This moves them to Trash and can be restored later.
            </p>
            <div className="flex-row gap-sm">
              <button
                onClick={() => handleDelete(deleteTarget.id)}
                disabled={actingId === deleteTarget.id}
                style={{
                  padding: "0.4rem 1rem",
                  background: "#ba1a1a",
                  color: "#fff",
                  border: "none",
                  borderRadius: "0.5rem",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {actingId === deleteTarget.id ? "Deleting…" : "Delete"}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{
                  padding: "0.4rem 1rem",
                  background: "none",
                  border: "1px solid var(--color-border)",
                  borderRadius: "0.5rem",
                  fontWeight: 500,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  color: "var(--color-text)",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Glass-card table container */}
      <div style={{
        background: "rgba(255, 255, 255, 0.7)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.6)",
        boxShadow: "0 8px 32px rgba(31, 107, 77, 0.08)",
        borderRadius: "0.75rem",
        overflow: "hidden",
      }}>
        <div className="table-responsive">
        <table className="staff-table" style={{
          width: "100%",
          textAlign: "left",
          borderCollapse: "collapse",
          boxShadow: "none",
          border: "none",
          borderRadius: 0,
        }}>
          <thead>
            <tr style={{ background: "#1F6B4D" }}>
              <th style={{
                padding: "1.25rem 1.5rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#fff",
                fontFamily: "var(--font-mono)",
              }}>Name</th>
              <th style={{
                padding: "1.25rem 1.5rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#fff",
                fontFamily: "var(--font-mono)",
              }}>Email</th>
              <th style={{
                padding: "1.25rem 1.5rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#fff",
                fontFamily: "var(--font-mono)",
                textAlign: "center",
              }}>Role</th>
              <th style={{
                padding: "1.25rem 1.5rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#fff",
                fontFamily: "var(--font-mono)",
              }}>Job Title</th>
              <th style={{
                padding: "1.25rem 1.5rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#fff",
                fontFamily: "var(--font-mono)",
                textAlign: "center",
              }}>Active</th>
              <th style={{
                padding: "1.25rem 1.5rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#fff",
                fontFamily: "var(--font-mono)",
                textAlign: "right",
              }}>Actions</th>
            </tr>
          </thead>
          <tbody style={{ fontSize: "0.875rem" }}>
            {pagedStaff.map((s) => {
              const roleStyle = ROLE_STYLE[s.role] ?? ROLE_STYLE.STAFF;
              const avatarBg = AVATAR_BG[s.role] ?? AVATAR_BG.STAFF;
              return (
                <tr
                  key={s.id}
                  style={{
                    borderBottom: "1px solid rgba(191, 201, 193, 0.2)",
                    opacity: s.isActive ? 1 : 0.65,
                    transition: "all 0.3s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.8)";
                    e.currentTarget.style.boxShadow = "0 0 20px rgba(31, 107, 77, 0.08)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.position = "relative";
                    e.currentTarget.style.zIndex = "10";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "";
                    e.currentTarget.style.boxShadow = "";
                    e.currentTarget.style.transform = "";
                    e.currentTarget.style.position = "";
                    e.currentTarget.style.zIndex = "";
                  }}
                >
                  <td data-label="Name" style={{ padding: "1.5rem 1.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        background: s.avatarUrl ? "none" : avatarBg,
                        color: "#fff",
                        border: "2px solid #fff",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        flexShrink: 0,
                        opacity: s.isActive ? 1 : 0.6,
                        overflow: "hidden",
                      }}>
                        {s.avatarUrl ? (
                          <img
                            src={`/api/account/avatar?userId=${encodeURIComponent(s.id)}`}
                            alt={`${s.name} avatar`}
                            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                          />
                        ) : (
                          getInitials(s.name)
                        )}
                      </div>
                      <Link
                        href={`/staff/${s.id}`}
                        style={{
                          color: "#1F6B4D",
                          textDecoration: "none",
                          fontWeight: 600,
                          fontSize: "0.95rem",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                      >
                        {s.name}
                      </Link>
                    </div>
                  </td>
                  <td data-label="Email" style={{ padding: "1.5rem 1.5rem", color: "var(--color-text-muted)", fontWeight: 500 }}>
                    {s.email}
                  </td>
                  <td data-label="Role" style={{ padding: "1.5rem 1.5rem", textAlign: "center" }}>
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "0.2rem 0.75rem",
                      borderRadius: "999px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.03em",
                      backgroundColor: roleStyle.bg,
                      color: roleStyle.text,
                      boxShadow: roleStyle.shadow,
                    }}>
                      {s.role}
                    </span>
                  </td>
                  <td data-label="Job Title" style={{ padding: "1.5rem 1.5rem", color: "var(--color-text-muted)", fontWeight: 500 }}>
                    {s.jobTitle?.name || "\u2014"}
                  </td>
                  <td data-label="Active" style={{ padding: "1.5rem 1.5rem", textAlign: "center" }}>
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      padding: "0.2rem 0.75rem",
                      borderRadius: "999px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.03em",
                      backgroundColor: s.isActive ? "#1F6B4D" : "var(--color-muted)",
                      color: s.isActive ? "#fff" : "var(--color-text-muted)",
                      boxShadow: s.isActive ? "0 2px 8px rgba(31,107,77,0.4)" : "none",
                      border: s.isActive ? "none" : "1px solid rgba(191,201,193,0.3)",
                    }}>
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: s.isActive ? "#fff" : "var(--color-text-light)",
                      }} />
                      {s.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td data-label="Actions" style={{ padding: "1.5rem 1.5rem", textAlign: "right", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.75rem" }}>
                      <button
                        onClick={() => startEdit(s)}
                        title="Edit"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "0.5rem",
                          borderRadius: "0.5rem",
                          color: "var(--color-text-muted)",
                          transition: "all 0.15s",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "#1F6B4D";
                          e.currentTarget.style.background = "rgba(31,107,77,0.08)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "var(--color-text-muted)";
                          e.currentTarget.style.background = "none";
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "1.375rem" }}>edit</span>
                      </button>
                      {s.isActive ? (
                        <>
                          <button
                            onClick={() => setDeactivateTarget(s)}
                            disabled={actingId === s.id}
                            title="Deactivate"
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "0.5rem",
                              borderRadius: "0.5rem",
                              color: "var(--color-text-muted)",
                              transition: "all 0.15s",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = "#ba1a1a";
                              e.currentTarget.style.background = "rgba(186,26,26,0.08)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = "var(--color-text-muted)";
                              e.currentTarget.style.background = "none";
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "1.375rem" }}>block</span>
                          </button>
                          <button
                            onClick={() => setDeleteTarget(s)}
                            disabled={actingId === s.id}
                            title="Delete"
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "0.5rem",
                              borderRadius: "0.5rem",
                              color: "var(--color-text-muted)",
                              transition: "all 0.15s",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = "#ba1a1a";
                              e.currentTarget.style.background = "rgba(186,26,26,0.08)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = "var(--color-text-muted)";
                              e.currentTarget.style.background = "none";
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "1.375rem" }}>delete</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleReactivate(s.id)}
                            disabled={actingId === s.id}
                            title="Reactivate"
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "0.5rem",
                              borderRadius: "0.5rem",
                              color: "var(--color-text-muted)",
                              transition: "all 0.15s",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = "#1F6B4D";
                              e.currentTarget.style.background = "rgba(31,107,77,0.08)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = "var(--color-text-muted)";
                              e.currentTarget.style.background = "none";
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "1.375rem" }}>restart_alt</span>
                          </button>
                          <button
                            onClick={() => setDeleteTarget(s)}
                            disabled={actingId === s.id}
                            title="Delete"
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "0.5rem",
                              borderRadius: "0.5rem",
                              color: "var(--color-text-muted)",
                              transition: "all 0.15s",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = "#ba1a1a";
                              e.currentTarget.style.background = "rgba(186,26,26,0.08)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = "var(--color-text-muted)";
                              e.currentTarget.style.background = "none";
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "1.375rem" }}>delete</span>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>

        {/* Pagination footer */}
        <div style={{
          padding: "1rem 1.5rem",
          borderTop: "1px solid rgba(191, 201, 193, 0.3)",
          background: "rgba(255,255,255,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "0.8125rem",
          color: "var(--color-text-muted)",
        }}>
          <span style={{ fontWeight: 500 }}>
            Showing {showingFrom} to {showingTo} of {staff.length} entries
          </span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setPage(clampedPage - 1)}
              disabled={clampedPage === 0}
              style={{
                padding: "0.4rem 1rem",
                border: "1px solid rgba(191,201,193,0.5)",
                borderRadius: "0.5rem",
                background: "#fff",
                cursor: clampedPage === 0 ? "default" : "pointer",
                opacity: clampedPage === 0 ? 0.5 : 1,
                fontSize: "0.8125rem",
                fontWeight: 500,
                color: "var(--color-text)",
                fontFamily: "inherit",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) e.currentTarget.style.background = "#f5f5f5";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#fff";
              }}
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage(clampedPage + 1)}
              disabled={clampedPage >= totalPages - 1}
              style={{
                padding: "0.4rem 1rem",
                border: "1px solid rgba(191,201,193,0.5)",
                borderRadius: "0.5rem",
                background: "#fff",
                cursor: clampedPage >= totalPages - 1 ? "default" : "pointer",
                opacity: clampedPage >= totalPages - 1 ? 0.5 : 1,
                fontSize: "0.8125rem",
                fontWeight: 500,
                color: "var(--color-text)",
                fontFamily: "inherit",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) e.currentTarget.style.background = "#f5f5f5";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#fff";
              }}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* Trash modal */}
      {showTrash && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0, 0, 0, 0.4)",
              backdropFilter: "blur(4px)",
            }}
            onClick={() => { setShowTrash(false); setPermanentDeleteTarget(null); }}
          />
          <div
            style={{
              position: "relative",
              background: "#FAF7F0",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.4)",
              boxShadow: "0 20px 40px rgba(31, 107, 77, 0.25)",
              borderTop: "4px solid #D9A441",
              maxWidth: 800,
              width: "calc(100% - 2rem)",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              margin: "0 1rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem 0", flexShrink: 0 }}>
              <h3 style={{ margin: 0, color: "#1F6B4D", fontSize: "1.1rem", fontWeight: 700 }}>Trash</h3>
              <button
                onClick={() => { setShowTrash(false); setPermanentDeleteTarget(null); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.5rem", color: "#1F6B4D", lineHeight: 1, padding: "0.25rem" }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: "1rem 1.5rem 1.5rem" }}>
              {trashLoading ? (
                <p style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "2rem 0" }}>Loading…</p>
              ) : !trash || trash.length === 0 ? (
                <p style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "2rem 0" }}>Trash is empty.</p>
              ) : (
                <div className="table-responsive">
                <table className="table-card" style={{ boxShadow: "none", border: "none", borderRadius: 0, width: "100%" }}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th style={{ textAlign: "center" }}>Role</th>
                      <th>Job Title</th>
                      <th>Deleted</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trash.map((s) => (
                      <tr key={s.id}>
                        <td data-label="Name" style={{ fontWeight: 600 }}>{s.name}</td>
                        <td data-label="Email">{s.email}</td>
                        <td data-label="Role" style={{ textAlign: "center" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "0.15rem 0.5rem",
                            borderRadius: "var(--radius-sm)",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            backgroundColor: s.role === "MANAGER" ? "var(--color-accent)" : "var(--color-muted)",
                            color: s.role === "STAFF" ? "var(--color-text)" : "#fff",
                          }}>
                            {s.role}
                          </span>
                        </td>
                        <td data-label="Job Title">{s.jobTitle?.name || "\u2014"}</td>
                        <td data-label="Deleted" style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>
                          {formatTrashDate(s.deletedAt)}
                        </td>
                        <td data-label="Actions" style={{ whiteSpace: "nowrap" }}>
                          <div className="flex-row gap-sm">
                            <button
                              onClick={() => handleTrashRestore(s.id)}
                              disabled={restoringId === s.id}
                              className="btn btn-success btn-sm"
                            >
                              {restoringId === s.id ? "…" : "Restore"}
                            </button>
                            <button
                              onClick={() => setPermanentDeleteTarget(s)}
                              className="btn btn-danger btn-sm"
                            >
                              Delete Forever
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>

          {/* Permanent Delete confirmation modal (above trash) */}
          {permanentDeleteTarget && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 110,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0, 0, 0, 0.2)",
                }}
                onClick={() => setPermanentDeleteTarget(null)}
              />
              <div
                style={{
                  position: "relative",
                  background: "#FAF7F0",
                  borderRadius: "12px",
                  border: "1px solid rgba(255, 255, 255, 0.4)",
                  boxShadow: "0 20px 40px rgba(31, 107, 77, 0.25)",
                  borderTop: "4px solid #ba1a1a",
                  maxWidth: 440,
                  width: "calc(100% - 2rem)",
                  margin: "0 1rem",
                  padding: "1.5rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <h3 style={{ margin: 0, color: "#ba1a1a", fontSize: "1.05rem", fontWeight: 700 }}>Permanent Delete</h3>
                  <button
                    onClick={() => setPermanentDeleteTarget(null)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.5rem", color: "#1F6B4D", lineHeight: 1, padding: "0.25rem" }}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                <p style={{ margin: "0 0 1rem", fontSize: "0.9rem", color: "var(--color-text)" }}>
                  Permanently delete <strong>{permanentDeleteTarget.name}</strong>? This cannot be undone.
                </p>
                <div className="flex-row gap-sm">
                  <button
                    onClick={() => handleTrashPermanentDelete(permanentDeleteTarget.id)}
                    disabled={deletingPerm}
                    style={{
                      padding: "0.4rem 1rem",
                      background: "#ba1a1a",
                      color: "#fff",
                      border: "none",
                      borderRadius: "0.5rem",
                      fontWeight: 600,
                      fontSize: "0.8125rem",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {deletingPerm ? "Deleting…" : "Permanently Delete"}
                  </button>
                  <button
                    onClick={() => setPermanentDeleteTarget(null)}
                    style={{
                      padding: "0.4rem 1rem",
                      background: "none",
                      border: "1px solid var(--color-border)",
                      borderRadius: "0.5rem",
                      fontWeight: 500,
                      fontSize: "0.8125rem",
                      cursor: "pointer",
                      color: "var(--color-text)",
                      fontFamily: "inherit",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grant to All Staff modal */}
      {showBulkGrant && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 120,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0, 0, 0, 0.4)",
              backdropFilter: "blur(4px)",
            }}
            onClick={() => { setShowBulkGrant(false); setBulkError(""); }}
          />
          <div
            style={{
              position: "relative",
              background: "#FAF7F0",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.4)",
              boxShadow: "0 20px 40px rgba(31, 107, 77, 0.25)",
              borderTop: "4px solid #D9A441",
              maxWidth: 500,
              width: "calc(100% - 2rem)",
              maxHeight: "90vh",
              overflowY: "auto",
              margin: "0 1rem",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, color: "#1F6B4D", fontSize: "1.1rem", fontWeight: 700 }}>Grant to All Staff</h3>
              <button
                onClick={() => { setShowBulkGrant(false); setBulkError(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.5rem", color: "#1F6B4D", lineHeight: 1, padding: "0.25rem" }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleBulkGrant}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label className="form-label">Leave Type</label>
                <select
                  value={bulkTypeId}
                  onChange={(e) => {
                    const selected = leaveTypes.find((t) => t.id === e.target.value);
                    setBulkTypeId(e.target.value);
                    if (selected) setBulkDays(selected.defaultDays);
                  }}
                  className="form-select"
                >
                  {leaveTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <label className="form-label">Days</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={bulkDays}
                    onChange={(e) => setBulkDays(Number(e.target.value))}
                    className="form-input"
                  />
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label className="form-label">Grant Date</label>
                  <input
                    type="date"
                    value={bulkDate}
                    onChange={(e) => setBulkDate(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label className="form-label">Note (optional)</label>
                <input
                  type="text"
                  value={bulkNote}
                  onChange={(e) => setBulkNote(e.target.value)}
                  className="form-input"
                  placeholder="e.g. Q2 2026 grant"
                />
              </div>
              {bulkError && <p className="form-error mb-1">{bulkError}</p>}
              <div className="flex-row gap-sm">
                <button type="submit" disabled={bulkSaving} className="btn btn-success">
                  {bulkSaving ? "Granting..." : "Grant to All"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => { setShowBulkGrant(false); setBulkError(""); }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function adisToday(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}
