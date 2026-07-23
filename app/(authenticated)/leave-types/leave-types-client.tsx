"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/modules/core/components/card";

interface LeaveType {
  id: string;
  name: string;
  isAnnualRecurring: boolean;
  mappedStatus: string;
}

interface Props {
  initialTypes: LeaveType[];
}

const STATUS_OPTIONS = ["PERMISSION", "ANNUAL_LEAVE", "OTHER"];

export default function LeaveTypesClient({ initialTypes }: Props) {
  const router = useRouter();
  const [types, setTypes] = useState<LeaveType[]>(initialTypes);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [isAnnual, setIsAnnual] = useState(false);
  const [mappedStatus, setMappedStatus] = useState("PERMISSION");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");

    const body: Record<string, unknown> = { name: name.trim(), isAnnualRecurring: isAnnual };
    if (editingId) {
      body.id = editingId;
    } else {
      body.mappedStatus = mappedStatus;
    }

    const res = await fetch("/api/leave-types", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to save.");
      setSaving(false);
      return;
    }

    if (editingId) {
      setTypes((prev) => prev.map((t) => (t.id === editingId ? data : t)));
    } else {
      setTypes((prev) => [...prev, data]);
    }

    setShowForm(false);
    setEditingId(null);
    setName("");
    setIsAnnual(false);
    setMappedStatus("PERMISSION");
    setSaving(false);
    router.refresh();
  }

  function startEdit(t: LeaveType) {
    setEditingId(t.id);
    setName(t.name);
    setIsAnnual(t.isAnnualRecurring);
    setMappedStatus(t.mappedStatus);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setName("");
    setIsAnnual(false);
    setMappedStatus("PERMISSION");
    setError("");
  }

  return (
    <div className="page-container" style={{ maxWidth: 860 }}>
      <h1 className="page-title">Leave Types</h1>

      {!showForm && (
        <button onClick={() => setShowForm(true)} className="btn btn-primary mb-2">
          + Add Leave Type
        </button>
      )}

      {showForm && (
        <Card style={{ marginBottom: "1.5rem" }}>
          <form onSubmit={handleSave}>
            <h3 style={{ marginTop: 0, color: "var(--color-brand)", fontSize: "1rem" }}>
              {editingId ? "Edit Leave Type" : "New Leave Type"}
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
              <label className="form-checkbox">
                <input
                  type="checkbox"
                  checked={isAnnual}
                  onChange={(e) => setIsAnnual(e.target.checked)}
                />
                Annual (grants expire after 2 years)
              </label>
            </div>

            {!editingId && (
              <div style={{ marginBottom: "0.75rem" }}>
                <label className="form-label">Mapped Status</label>
                <select
                  value={mappedStatus}
                  onChange={(e) => setMappedStatus(e.target.value)}
                  className="form-select"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s === "PERMISSION" ? "Permission" : s === "ANNUAL_LEAVE" ? "Annual Leave" : "Other"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {error && <p className="form-error mb-1">{error}</p>}

            <div className="flex-row gap-sm">
              <button type="submit" disabled={saving} className="btn btn-success">
                {saving ? "Saving..." : "Save"}
              </button>
              <button type="button" onClick={cancelForm} className="btn btn-ghost">
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {types.length === 0 ? (
        <Card>
          <p className="text-muted text-center" style={{ padding: "1rem 0", margin: 0 }}>
            No leave types yet. Add one to get started.
          </p>
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table className="table-card" style={{ boxShadow: "none", border: "none", borderRadius: 0 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th style={{ textAlign: "center" }}>Annual</th>
                <th>Mapped Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.name}</td>
                  <td style={{ textAlign: "center" }}>{t.isAnnualRecurring ? "Yes" : "No"}</td>
                  <td>{t.mappedStatus}</td>
                  <td>
                    <button onClick={() => startEdit(t)} className="btn btn-primary btn-sm">
                      Edit
                    </button>
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
