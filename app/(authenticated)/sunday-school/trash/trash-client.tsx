"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/modules/core/components/card";
import { formatDate } from "@/lib/format";

interface TrashClass {
  id: string;
  name: string;
  teacher: { id: string; name: string } | null;
  deletedAt: string | null;
}

interface Props {
  initialTrash: TrashClass[];
}

export default function SundaySchoolTrashClient({ initialTrash }: Props) {
  const router = useRouter();
  const [trash, setTrash] = useState<TrashClass[]>(initialTrash);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<TrashClass | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  async function handleRestore(id: string) {
    setRestoringId(id);
    const res = await fetch(`/api/sunday-school/classes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    });
    if (res.ok) {
      setTrash((prev) => prev.filter((s) => s.id !== id));
    }
    setRestoringId(null);
    router.refresh();
  }

  function openPermanentDelete(s: TrashClass) {
    setPermanentDeleteTarget(s);
    setConfirmation("");
  }

  async function handlePermanentDelete() {
    if (!permanentDeleteTarget || confirmation !== "DELETE") return;
    setDeleting(true);
    const res = await fetch(`/api/sunday-school/classes/${permanentDeleteTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "permanent-delete", confirmation }),
    });
    if (res.ok) {
      setTrash((prev) => prev.filter((s) => s.id !== permanentDeleteTarget.id));
      setPermanentDeleteTarget(null);
    }
    setDeleting(false);
    router.refresh();
  }

  function formatTrashDate(dateStr: string | null) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return `${formatDate(d)}, ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
  }

  return (
    <div className="page-container" style={{ maxWidth: 960 }}>
      <h1 className="page-title">Sunday School Trash</h1>

      <Link href="/sunday-school" className="btn btn-ghost mb-2">
        ← Back to Sunday School
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
                  <th>Class</th>
                  <th>Teacher</th>
                  <th>Deleted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {trash.map((s) => (
                  <tr key={s.id}>
                    <td data-label="Class" style={{ fontWeight: 600 }}>{s.name}</td>
                    <td data-label="Teacher">{s.teacher?.name || "—"}</td>
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
                          onClick={() => openPermanentDelete(s)}
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

      {/* Permanent Delete confirmation modal with typed confirmation */}
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
              Permanently delete <strong>{permanentDeleteTarget.name}</strong>? This cannot be undone. Attendance
              records for this class will be kept but unlinked.
            </p>
            <div style={{ marginBottom: "1rem" }}>
              <label className="form-label">Type DELETE to confirm</label>
              <input
                type="text"
                className="form-input"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="DELETE"
              />
            </div>
            <div className="flex-row gap-sm">
              <button
                onClick={handlePermanentDelete}
                disabled={deleting || confirmation !== "DELETE"}
                style={{
                  padding: "0.4rem 1rem",
                  background: "#ba1a1a",
                  color: "#fff",
                  border: "none",
                  borderRadius: "0.5rem",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  cursor: confirmation === "DELETE" && !deleting ? "pointer" : "not-allowed",
                  fontFamily: "inherit",
                  opacity: confirmation === "DELETE" && !deleting ? 1 : 0.6,
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
