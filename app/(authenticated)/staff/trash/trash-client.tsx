"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/modules/core/components/card";

interface TrashMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  deletedAt: string;
}

interface Props {
  initialTrash: TrashMember[];
}

export default function TrashClient({ initialTrash }: Props) {
  const router = useRouter();
  const [trash, setTrash] = useState<TrashMember[]>(initialTrash);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [permanentDeleteId, setPermanentDeleteId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleRestore(id: string) {
    setRestoringId(id);
    const res = await fetch("/api/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "restore" }),
    });
    if (res.ok) {
      setTrash((prev) => prev.filter((s) => s.id !== id));
    }
    setRestoringId(null);
    router.refresh();
  }

  async function handlePermanentDelete(id: string) {
    if (deleteConfirmation !== "DELETE") return;
    setDeleting(true);
    const res = await fetch("/api/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "permanent-delete", confirmation: "DELETE" }),
    });
    if (res.ok) {
      setTrash((prev) => prev.filter((s) => s.id !== id));
      setPermanentDeleteId(null);
      setDeleteConfirmation("");
    }
    setDeleting(false);
    router.refresh();
  }

  function formatDeletedDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="page-container" style={{ maxWidth: 960 }}>
      <h1 className="page-title">Trash</h1>

      <Link href="/staff" className="btn btn-ghost mb-2">
        ← Back to Staff
      </Link>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {trash.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-muted)" }}>
            Trash is empty.
          </div>
        ) : (
          <table className="table-card" style={{ boxShadow: "none", border: "none", borderRadius: 0 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th style={{ textAlign: "center" }}>Role</th>
                <th>Department</th>
                <th>Deleted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {trash.map((s) => (
                <tr key={s.id}>
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
                  <td style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>
                    {formatDeletedDate(s.deletedAt)}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div className="flex-row gap-sm">
                      <button
                        onClick={() => handleRestore(s.id)}
                        disabled={restoringId === s.id}
                        className="btn btn-success btn-sm"
                      >
                        {restoringId === s.id ? "…" : "Restore"}
                      </button>
                      {permanentDeleteId === s.id ? (
                        <div className="flex-row gap-sm" style={{ alignItems: "center" }}>
                          <input
                            type="text"
                            placeholder='Type "DELETE"'
                            value={deleteConfirmation}
                            onChange={(e) => setDeleteConfirmation(e.target.value)}
                            className="form-input"
                            style={{ width: 120, fontSize: "0.8rem" }}
                            autoFocus
                          />
                          <button
                            onClick={() => handlePermanentDelete(s.id)}
                            disabled={deleting || deleteConfirmation !== "DELETE"}
                            className="btn btn-danger btn-sm"
                          >
                            {deleting ? "…" : "Confirm"}
                          </button>
                          <button
                            onClick={() => {
                              setPermanentDeleteId(null);
                              setDeleteConfirmation("");
                            }}
                            className="btn btn-ghost btn-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPermanentDeleteId(s.id)}
                          className="btn btn-danger btn-sm"
                        >
                          Delete Forever
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
