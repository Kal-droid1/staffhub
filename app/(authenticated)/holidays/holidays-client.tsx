"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/modules/core/components/card";

interface Holiday {
  id: string;
  date: string;
  name: string;
  year: number;
  isDefault: boolean;
}

interface Props {
  initialHolidays: Holiday[];
  initialYear: number;
  currentYear: number;
}

export default function HolidaysClient({ initialHolidays: initialData, initialYear, currentYear }: Props) {
  const router = useRouter();
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [holidays, setHolidays] = useState<Holiday[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchYear(year: number) {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/holidays?year=${year}`);
    if (res.ok) {
      const data = await res.json();
      setHolidays(data);
    }
    setLoading(false);
  }

  async function handleYearChange(year: number) {
    setSelectedYear(year);
    await fetchYear(year);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newDate || !newName.trim()) return;
    setSaving(true);
    setError("");

    const res = await fetch("/api/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: newDate, name: newName.trim(), year: selectedYear }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to add.");
      setSaving(false);
      return;
    }

    setHolidays((prev) => [...prev, data]);
    setShowForm(false);
    setNewDate("");
    setNewName("");
    setSaving(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this holiday?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/holidays?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setHolidays((prev) => prev.filter((h) => h.id !== id));
    }
    setDeletingId(null);
    router.refresh();
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="page-container" style={{ maxWidth: 860 }}>
      <h1 className="page-title">Holidays</h1>

      <div style={{ marginBottom: "1.25rem" }}>
        <label className="form-label">Ethiopian Year</label>
        <select
          value={selectedYear}
          onChange={(e) => handleYearChange(Number(e.target.value))}
          className="form-select"
          style={{ minWidth: 150 }}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {!showForm && (
        <button onClick={() => setShowForm(true)} className="btn btn-primary mb-2">
          + Add Holiday
        </button>
      )}

      {showForm && (
        <Card style={{ marginBottom: "1.5rem" }}>
          <form onSubmit={handleAdd}>
            <h3 style={{ marginTop: 0, color: "var(--color-brand)", fontSize: "1rem" }}>
              Add Holiday
            </h3>

            <div style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Gregorian Date</label>
              <input
                type="date"
                className="form-input"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Name</label>
              <input
                type="text"
                className="form-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Eid al-Fitr"
                required
              />
            </div>

            {error && <p className="form-error mb-1">{error}</p>}

            <div className="flex-row gap-sm">
              <button type="submit" disabled={saving} className="btn btn-success">
                {saving ? "Adding..." : "Add"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setNewDate("");
                  setNewName("");
                  setError("");
                }}
                className="btn btn-ghost"
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {loading && (
        <Card>
          <p className="text-muted text-center" style={{ padding: "1rem 0", margin: 0 }}>
            Loading...
          </p>
        </Card>
      )}

      {!loading && holidays.length === 0 && (
        <Card>
          <p className="text-muted text-center" style={{ padding: "1rem 0", margin: 0 }}>
            No holidays for this year. Add one above.
          </p>
        </Card>
      )}

      {!loading && holidays.length > 0 && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table className="table-card" style={{ boxShadow: "none", border: "none", borderRadius: 0 }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th style={{ textAlign: "center" }}>Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((h) => (
                <tr key={h.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {new Date(h.date).toLocaleDateString()}
                  </td>
                  <td style={{ fontWeight: 600 }}>{h.name}</td>
                  <td style={{ textAlign: "center" }}>
                    {h.isDefault ? "Default" : "Custom"}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      onClick={() => handleDelete(h.id)}
                      disabled={deletingId === h.id}
                      className="btn btn-danger btn-sm"
                    >
                      {deletingId === h.id ? "Deleting..." : "Delete"}
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
