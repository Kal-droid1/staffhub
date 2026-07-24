"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/modules/core/components/card";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Props {
  initialStaff: StaffMember[];
}

const ROLE_OPTIONS = ["STAFF", "MANAGER", "ADMIN"];

export default function StaffClient({ initialStaff }: Props) {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("STAFF");
  const [department, setDepartment] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setName("");
    setEmail("");
    setRole("STAFF");
    setDepartment("");
    setPassword("");
    setError("");
  }

  function startEdit(s: StaffMember) {
    setEditingId(s.id);
    setName(s.name);
    setEmail(s.email);
    setRole(s.role);
    setDepartment(s.department ?? "");
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

    const isNew = !editingId;

    const res = await fetch("/api/staff", {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isNew
          ? { name: name.trim(), email: email.trim(), password, role, department: department || undefined }
          : { id: editingId, name: name.trim(), email: email.trim(), role, department: department || undefined }
      ),
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

  async function handleToggleActive(id: string, current: boolean) {
    setTogglingId(id);
    const res = await fetch("/api/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: !current }),
    });
    if (res.ok) {
      const updated = await res.json();
      setStaff((prev) => prev.map((s) => (s.id === id ? updated : s)));
    }
    setTogglingId(null);
    router.refresh();
  }

  return (
    <div className="page-container" style={{ maxWidth: 960 }}>
      <h1 className="page-title">Staff</h1>

      {!showForm && (
        <button onClick={() => setShowForm(true)} className="btn btn-primary mb-2">
          + Add Staff
        </button>
      )}

      {showForm && (
        <Card style={{ marginBottom: "1.5rem" }}>
          <form onSubmit={handleSave}>
            <h3 style={{ marginTop: 0, color: "var(--color-brand)", fontSize: "1rem" }}>
              {editingId ? "Edit Staff" : "New Staff"}
            </h3>

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
              <label className="form-label">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="form-select"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Department (optional)</label>
              <input
                type="text"
                className="form-input"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
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

            <div className="flex-row gap-sm">
              <button type="submit" disabled={saving} className="btn btn-success">
                {saving ? "Saving..." : "Save"}
              </button>
              <button type="button" onClick={resetForm} className="btn btn-ghost">
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table className="table-card" style={{ boxShadow: "none", border: "none", borderRadius: 0 }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th style={{ textAlign: "center" }}>Role</th>
              <th>Department</th>
              <th style={{ textAlign: "center" }}>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} style={{ opacity: s.isActive ? 1 : 0.55 }}>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td>{s.email}</td>
                <td style={{ textAlign: "center" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.15rem 0.5rem",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      backgroundColor:
                        s.role === "ADMIN"
                          ? "var(--color-danger)"
                          : s.role === "MANAGER"
                            ? "var(--color-accent)"
                            : "var(--color-muted)",
                      color: s.role === "STAFF" ? "var(--color-text)" : "#fff",
                    }}
                  >
                    {s.role}
                  </span>
                </td>
                <td>{s.department || "\u2014"}</td>
                <td style={{ textAlign: "center" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.15rem 0.5rem",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      backgroundColor: s.isActive ? "var(--color-success)" : "var(--color-danger)",
                      color: "#fff",
                    }}
                  >
                    {s.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <div className="flex-row gap-sm">
                    <button onClick={() => startEdit(s)} className="btn btn-primary btn-sm">
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleActive(s.id, s.isActive)}
                      disabled={togglingId === s.id}
                      className={s.isActive ? "btn btn-danger btn-sm" : "btn btn-success btn-sm"}
                    >
                      {togglingId === s.id ? "…" : s.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
