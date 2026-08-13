"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Card from "@/modules/core/components/card";

const TABS = [
  { id: "password", label: "Change Password" },
  { id: "leave-types", label: "Leave Types" },
  { id: "job-titles", label: "Job Titles" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface Props {
  role: string;
}

export default function SettingsClient({ role }: Props) {
  const router = useRouter();
  const visibleTabs = role === "MANAGER" || role === "ADMIN" ? TABS : TABS.filter((t) => t.id === "password");
  const [tab, setTab] = useState<TabId>("password");

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#1F6B4D", margin: "0 0 0.35rem", letterSpacing: "-0.02em" }}>
        Settings
      </h1>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "0.25rem", margin: "1.5rem 0", borderBottom: "2px solid rgba(31,107,77,0.1)", paddingBottom: 0 }}>
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "0.6rem 1.25rem",
              background: "none",
              border: "none",
              borderBottom: tab === t.id ? "2px solid #1F6B4D" : "2px solid transparent",
              borderRadius: "0.25rem 0.25rem 0 0",
              color: tab === t.id ? "#1F6B4D" : "var(--color-text-muted)",
              fontWeight: tab === t.id ? 700 : 500,
              fontSize: "0.85rem",
              cursor: "pointer",
              fontFamily: "inherit",
              marginBottom: -2,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "password" && <ChangePasswordSection />}
      {tab === "leave-types" && <LeaveTypesSection />}
      {tab === "job-titles" && <JobTitlesSection />}
    </div>
  );
}

/* ---- Change Password Section ---- */

function ChangePasswordSection() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/account/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to change password.");
      setLoading(false);
      return;
    }

    setSuccess("Password changed successfully.");
    setNewPassword("");
    setConfirmPassword("");
    setLoading(false);
  }

  return (
    <Card style={{ maxWidth: 480 }}>
      <h3 style={{ margin: "0 0 1rem", color: "var(--color-brand)", fontSize: "1rem", fontWeight: 600 }}>Change Your Password</h3>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "0.75rem" }}>
          <label className="form-label">New Password</label>
          <input type="password" className="form-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label className="form-label">Confirm New Password</label>
          <input type="password" className="form-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        </div>
        {error && <p className="form-error mb-1">{error}</p>}
        {success && <p className="form-success mb-1">{success}</p>}
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? "Changing..." : "Change Password"}
        </button>
      </form>
    </Card>
  );
}

/* ---- Leave Types Section (inlined from leave-types-client.tsx) ---- */

function LeaveTypesSection() {
  const [types, setTypes] = useState<{ id: string; name: string; isAnnualRecurring: boolean; mappedStatus: string; defaultDays: number; requiresAttachment: boolean }[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [isAnnual, setIsAnnual] = useState(false);
  const [mappedStatus, setMappedStatus] = useState("PERMISSION");
  const [defaultDays, setDefaultDays] = useState(20);
  const [requiresAttachment, setRequiresAttachment] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const STATUS_OPTIONS = ["PERMISSION", "ANNUAL_LEAVE", "OTHER"];

  useEffect(() => {
    fetch("/api/leave-types").then(r => r.json()).then(setTypes);
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    const body: Record<string, unknown> = { name: name.trim(), isAnnualRecurring: isAnnual, defaultDays, requiresAttachment };
    if (editingId) body.id = editingId; else body.mappedStatus = mappedStatus;
    const res = await fetch("/api/leave-types", { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed to save."); setSaving(false); return; }
    setTypes(prev => editingId ? (prev ?? []).map(t => t.id === editingId ? data : t) : [...(prev ?? []), data]);
    setShowForm(false); setEditingId(null); setName(""); setIsAnnual(false); setMappedStatus("PERMISSION"); setDefaultDays(20); setRequiresAttachment(false); setSaving(false);
  }

  function startEdit(t: any) { setEditingId(t.id); setName(t.name); setIsAnnual(t.isAnnualRecurring); setMappedStatus(t.mappedStatus); setDefaultDays(t.defaultDays); setRequiresAttachment(t.requiresAttachment); setShowForm(true); }
  function cancelForm() { setShowForm(false); setEditingId(null); setName(""); setIsAnnual(false); setMappedStatus("PERMISSION"); setDefaultDays(20); setRequiresAttachment(false); setError(""); }

  async function handleDelete(id: string) {
    if (!confirm("Delete this leave type and all its grants?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/leave-types?id=${id}`, { method: "DELETE" });
    if (res.ok) setTypes(prev => (prev ?? []).filter(t => t.id !== id));
    setDeletingId(null);
  }

  if (!types) return <p style={{ color: "var(--color-text-muted)", padding: "2rem 0", textAlign: "center" }}>Loading…</p>;

  return (
    <div>
      {!showForm && <button onClick={() => setShowForm(true)} className="btn btn-primary mb-2">+ Add Leave Type</button>}
      {showForm && (
        <Card style={{ marginBottom: "1.5rem" }}>
          <form onSubmit={handleSave}>
            <h3 style={{ marginTop: 0, color: "var(--color-brand)", fontSize: "1rem" }}>{editingId ? "Edit Leave Type" : "New Leave Type"}</h3>
            <div style={{ marginBottom: "0.75rem" }}><label className="form-label">Name</label><input type="text" className="form-input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div style={{ marginBottom: "0.75rem" }}><label className="form-checkbox"><input type="checkbox" checked={isAnnual} onChange={(e) => setIsAnnual(e.target.checked)} /> Annual (grants expire after 2 years)</label></div>
            <div style={{ marginBottom: "0.75rem" }}><label className="form-label">Default Days</label><input type="number" className="form-input" min="0.5" step="0.5" value={defaultDays} onChange={(e) => setDefaultDays(Number(e.target.value))} style={{ maxWidth: 120 }} /></div>
            {!editingId && <div style={{ marginBottom: "0.75rem" }}><label className="form-label">Mapped Status</label><select value={mappedStatus} onChange={(e) => setMappedStatus(e.target.value)} className="form-select">{STATUS_OPTIONS.map(s => <option key={s} value={s}>{s === "PERMISSION" ? "Permission" : s === "ANNUAL_LEAVE" ? "Annual Leave" : "Other"}</option>)}</select></div>}
            <div style={{ marginBottom: "0.75rem" }}><label className="form-checkbox"><input type="checkbox" checked={requiresAttachment} onChange={(e) => setRequiresAttachment(e.target.checked)} /> Requires signed attachment</label></div>
            {error && <p className="form-error mb-1">{error}</p>}
            <div className="flex-row gap-sm"><button type="submit" disabled={saving} className="btn btn-success">{saving ? "Saving..." : "Save"}</button><button type="button" onClick={cancelForm} className="btn btn-ghost">Cancel</button></div>
          </form>
        </Card>
      )}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-responsive"><table className="table-card" style={{ boxShadow: "none", border: "none", borderRadius: 0 }}>
          <thead><tr><th>Name</th><th style={{ textAlign: "center" }}>Annual</th><th style={{ textAlign: "center" }}>Default Days</th><th>Mapped Status</th><th style={{ textAlign: "center" }}>Attachment</th><th>Actions</th></tr></thead>
          <tbody>{types.map((t: any) => (
            <tr key={t.id}><td data-label="Name" style={{ fontWeight: 600 }}>{t.name}</td><td data-label="Annual" style={{ textAlign: "center" }}>{t.isAnnualRecurring ? "Yes" : "No"}</td><td data-label="Default Days" style={{ textAlign: "center" }}>{t.defaultDays}</td><td data-label="Mapped Status">{t.mappedStatus}</td><td data-label="Attachment" style={{ textAlign: "center" }}>{t.requiresAttachment ? "Yes" : "No"}</td><td data-label="Actions" style={{ whiteSpace: "nowrap" }}><div className="flex-row gap-sm"><button onClick={() => startEdit(t)} className="btn btn-primary btn-sm">Edit</button><button onClick={() => handleDelete(t.id)} disabled={deletingId === t.id} className="btn btn-danger btn-sm">{deletingId === t.id ? "Deleting..." : "Delete"}</button></div></td></tr>
          ))}</tbody>
        </table></div>
      </Card>
    </div>
  );
}

/* ---- Job Titles Section (inlined from job-titles-client.tsx) ---- */

function JobTitlesSection() {
  const [titles, setTitles] = useState<{ id: string; name: string }[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/job-titles").then(r => r.json()).then(setTitles);
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true); setError("");
    const body: Record<string, unknown> = { name: name.trim() };
    if (editingId) body.id = editingId;
    const res = await fetch("/api/job-titles", { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed to save."); setSaving(false); return; }
    setTitles(prev => editingId ? (prev ?? []).map(t => t.id === editingId ? data : t) : [...(prev ?? []), data]);
    setShowForm(false); setEditingId(null); setName(""); setSaving(false);
  }

  function startEdit(t: any) { setEditingId(t.id); setName(t.name); setShowForm(true); }
  function cancelForm() { setShowForm(false); setEditingId(null); setName(""); setError(""); }

  async function handleDelete(id: string) {
    if (!confirm("Delete this job title? Staff members currently assigned to it will keep their assignment.")) return;
    setDeletingId(id);
    const res = await fetch(`/api/job-titles?id=${id}`, { method: "DELETE" });
    if (res.ok) setTitles(prev => (prev ?? []).filter(t => t.id !== id));
    setDeletingId(null);
  }

  if (!titles) return <p style={{ color: "var(--color-text-muted)", padding: "2rem 0", textAlign: "center" }}>Loading…</p>;

  return (
    <div>
      {!showForm && <button onClick={() => setShowForm(true)} className="btn btn-primary mb-2">+ Add Job Title</button>}
      {showForm && (
        <Card style={{ marginBottom: "1.5rem" }}>
          <form onSubmit={handleSave}>
            <h3 style={{ marginTop: 0, color: "var(--color-brand)", fontSize: "1rem" }}>{editingId ? "Edit Job Title" : "New Job Title"}</h3>
            <div style={{ marginBottom: "0.75rem" }}><label className="form-label">Name</label><input type="text" className="form-input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
            {error && <p className="form-error mb-1">{error}</p>}
            <div className="flex-row gap-sm"><button type="submit" disabled={saving} className="btn btn-success">{saving ? "Saving..." : "Save"}</button><button type="button" onClick={cancelForm} className="btn btn-ghost">Cancel</button></div>
          </form>
        </Card>
      )}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-responsive"><table className="table-card" style={{ boxShadow: "none", border: "none", borderRadius: 0 }}>
          <thead><tr><th>Name</th><th>Actions</th></tr></thead>
          <tbody>{titles.map(t => (
            <tr key={t.id}><td data-label="Name" style={{ fontWeight: 600 }}>{t.name}</td><td data-label="Actions" style={{ whiteSpace: "nowrap" }}><div className="flex-row gap-sm"><button onClick={() => startEdit(t)} className="btn btn-primary btn-sm">Edit</button><button onClick={() => handleDelete(t.id)} disabled={deletingId === t.id} className="btn btn-danger btn-sm">{deletingId === t.id ? "Deleting..." : "Delete"}</button></div></td></tr>
          ))}</tbody>
        </table></div>
      </Card>
    </div>
  );
}
