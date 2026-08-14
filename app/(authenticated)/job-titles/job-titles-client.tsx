"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/modules/core/components/card";
import ConfirmDialog from "@/modules/core/components/confirm-dialog";

interface JobTitle {
  id: string;
  name: string;
}

interface Props {
  initialTitles: JobTitle[];
}

export default function JobTitlesClient({ initialTitles }: Props) {
  const router = useRouter();
  const [titles, setTitles] = useState<JobTitle[]>(initialTitles);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JobTitle | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");

    const body: Record<string, unknown> = { name: name.trim() };
    if (editingId) body.id = editingId;

    const res = await fetch("/api/job-titles", {
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
      setTitles((prev) => prev.map((t) => (t.id === editingId ? data : t)));
    } else {
      setTitles((prev) => [...prev, data]);
    }

    setShowForm(false);
    setEditingId(null);
    setName("");
    setSaving(false);
    router.refresh();
  }

  function startEdit(t: JobTitle) {
    setEditingId(t.id);
    setName(t.name);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setName("");
    setError("");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeletingId(id);
    const res = await fetch(`/api/job-titles?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setTitles((prev) => prev.filter((t) => t.id !== id));
    }
    setDeletingId(null);
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <div className="page-container" style={{ maxWidth: 600 }}>
      <h1 className="page-title">Job Titles</h1>
      <p className="text-muted mb-2" style={{ fontSize: "0.85rem" }}>
        Manage the list of job titles available for staff records. Changes here update the dropdown shown on the Add/Edit Staff forms.
      </p>

      {!showForm && (
        <button onClick={() => setShowForm(true)} className="btn btn-primary mb-2">
          + Add Job Title
        </button>
      )}

      {showForm && (
        <Card style={{ marginBottom: "1.5rem" }}>
          <form onSubmit={handleSave}>
            <h3 style={{ marginTop: 0, color: "var(--color-brand)", fontSize: "1rem" }}>
              {editingId ? "Edit Job Title" : "New Job Title"}
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

      {titles.length === 0 ? (
        <Card>
          <p className="text-muted text-center" style={{ padding: "1rem 0", margin: 0 }}>
            No job titles yet. Add one to get started.
          </p>
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-responsive">
          <table className="table-card" style={{ boxShadow: "none", border: "none", borderRadius: 0 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {titles.map((t) => (
                <tr key={t.id}>
                  <td data-label="Name" style={{ fontWeight: 600 }}>{t.name}</td>
                  <td data-label="Actions" style={{ whiteSpace: "nowrap" }}>
                    <div className="flex-row gap-sm">
                      <button onClick={() => startEdit(t)} className="btn btn-primary btn-sm">
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(t)}
                        disabled={deletingId === t.id}
                        className="btn btn-danger btn-sm"
                      >
                        {deletingId === t.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Job Title"
        message={
          <>
            Delete <strong>{deleteTarget?.name}</strong>? Staff members currently assigned to it will keep their assignment.
          </>
        }
        confirmLabel="Delete"
        destructive
        busy={deletingId === deleteTarget?.id}
        busyLabel="Deleting…"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
