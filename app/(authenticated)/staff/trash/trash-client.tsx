"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/modules/core/components/card";
import { formatDate } from "@/lib/format";

interface TrashMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  jobTitle: { id: string; name: string } | null;
  deletedAt: string;
}

interface Props {
  initialTrash: TrashMember[];
}

export default function TrashClient({ initialTrash }: Props) {
  const router = useRouter();
  const [trash, setTrash] = useState<TrashMember[]>(initialTrash);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<TrashMember | null>(null);
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
    setDeleting(true);
    const res = await fetch("/api/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "permanent-delete", confirmation: "DELETE" }),
    });
    if (res.ok) {
      setTrash((prev) => prev.filter((s) => s.id !== id));
      setPermanentDeleteTarget(null);
    }
    setDeleting(false);
    router.refresh();
  }

  function formatTrashDate(dateStr: string) {
    const d = new Date(dateStr);
    return `${formatDate(d)}, ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
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
          <div className="table-responsive">
          <table className="table-card" style={{ boxShadow: "none", border: "none", borderRadius: 0 }}>
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
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        backgroundColor:
                            s.role === "MANAGER"
                              ? "var(--color-accent)"
                              : "var(--color-muted)",
                        color: s.role === "STAFF" ? "var(--color-text)" : "#fff",
                      }}
                    >
                      {s.role}
                    </span>
                  </td>
                  <td data-label="Job Title">{s.jobTitle?.name || "\u2014"}</td>
                  <td data-label="Deleted" style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>
                    {formatTrashDate(s.deletedAt)}
                  </td>
                  <td data-label="Actions" style={{ whiteSpace: "nowrap" }}>
                    <div className="flex-row gap-sm">
                      <button
                        onClick={() => handleRestore(s.id)}
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
      </Card>

      {/* Permanent Delete confirmation modal */}
      {permanentDeleteTarget && (
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
                onClick={() => handlePermanentDelete(permanentDeleteTarget.id)}
                disabled={deleting}
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
                {deleting ? "Deleting…" : "Permanently Delete"}
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
  );
}
