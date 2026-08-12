"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  jobTitleId: string | null;
  jobTitle: { id: string; name: string } | null;
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

interface Props {
  initialStaff: StaffMember[];
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

export default function StaffClient({ initialStaff }: Props) {
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

  return (
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
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link
            href="/staff/trash"
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
              textDecoration: "none",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(31,107,77,0.08)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.3)")}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "1.25rem" }}>delete</span>
            Trash
          </Link>
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
        <table style={{
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
                        background: avatarBg,
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
                      }}>
                        {getInitials(s.name)}
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
  );
}
