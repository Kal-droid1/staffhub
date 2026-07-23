"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <div style={{ maxWidth: 800, margin: "40px auto", padding: "0 1rem" }}>
      <h1>Leave Types</h1>

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "0.375rem",
            cursor: "pointer",
            marginBottom: "1.5rem",
          }}
        >
          + Add Leave Type
        </button>
      )}

      {showForm && (
        <form
          onSubmit={handleSave}
          style={{
            padding: "1rem",
            border: "1px solid #e5e7eb",
            borderRadius: "0.375rem",
            marginBottom: "1.5rem",
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            {editingId ? "Edit Leave Type" : "New Leave Type"}
          </h3>

          <div style={{ marginBottom: "0.75rem" }}>
            <label style={{ display: "block", fontWeight: 500, marginBottom: "0.25rem" }}>
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ marginBottom: "0.75rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 500 }}>
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
              <label style={{ display: "block", fontWeight: 500, marginBottom: "0.25rem" }}>
                Mapped Status
              </label>
              <select
                value={mappedStatus}
                onChange={(e) => setMappedStatus(e.target.value)}
                style={{ padding: "0.5rem" }}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s === "PERMISSION" ? "Permission" : s === "ANNUAL_LEAVE" ? "Annual Leave" : "Other"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && <p style={{ color: "#dc2626", marginBottom: "0.5rem" }}>{error}</p>}

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#16a34a",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                cursor: "pointer",
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#9ca3af",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
            <th style={{ padding: "0.75rem 0.5rem" }}>Name</th>
            <th style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>Annual</th>
            <th style={{ padding: "0.75rem 0.5rem" }}>Mapped Status</th>
            <th style={{ padding: "0.75rem 0.5rem" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {types.map((t) => (
            <tr key={t.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
              <td style={{ padding: "0.5rem" }}>
                <strong>{t.name}</strong>
              </td>
              <td style={{ padding: "0.5rem", textAlign: "center" }}>
                {t.isAnnualRecurring ? "Yes" : "No"}
              </td>
              <td style={{ padding: "0.5rem" }}>{t.mappedStatus}</td>
              <td style={{ padding: "0.5rem" }}>
                <button
                  onClick={() => startEdit(t)}
                  style={{
                    padding: "0.25rem 0.75rem",
                    backgroundColor: "#2563eb",
                    color: "white",
                    border: "none",
                    borderRadius: "0.25rem",
                    cursor: "pointer",
                  }}
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
          {types.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: "1rem", textAlign: "center", color: "#6b7280" }}>
                No leave types yet. Add one to get started.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
