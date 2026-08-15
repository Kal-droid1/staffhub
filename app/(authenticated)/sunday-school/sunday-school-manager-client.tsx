"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/modules/core/components/card";
import ConfirmDialog from "@/modules/core/components/confirm-dialog";
import {
  SUNDAY_SCHOOL_EXPORT_MONTH_OPTIONS,
  SUNDAY_SCHOOL_FIRST_EXPORT_MONTH,
} from "@/modules/sunday-school/export-months";

interface TeacherOption {
  id: string;
  name: string;
  email: string;
}

interface ClassParticipant {
  participant: {
    id: string;
    localParticipantId: string;
    name: string;
    gradeLevel: string | null;
  };
}

interface ClassRow {
  id: string;
  name: string;
  teacherId: string;
  teacher: { id: string; name: string };
  participants: ClassParticipant[];
}

interface Props {
  initialClasses: ClassRow[];
  initialTeachers: TeacherOption[];
}

interface SelectedParticipant {
  id: string;
  localParticipantId: string;
  name: string;
  gradeLevel: string | null;
}

export default function SundaySchoolManagerClient({ initialClasses, initialTeachers }: Props) {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassRow[]>(initialClasses);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<SelectedParticipant[]>([]);
  const [participantQuery, setParticipantQuery] = useState("");
  const [participantResults, setParticipantResults] = useState<SelectedParticipant[]>([]);
  const [searchingParticipants, setSearchingParticipants] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingMove, setPendingMove] = useState<{
    participants: SelectedParticipant[];
    fromClass: string;
  } | null>(null);

  // Bulk upload state
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [pendingBulkMove, setPendingBulkMove] = useState<{
    participants: SelectedParticipant[];
    conflicts: { name: string; fromClass: string }[];
  } | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<ClassRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Export state
  const [exportMonth, setExportMonth] = useState(SUNDAY_SCHOOL_FIRST_EXPORT_MONTH);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  function openCreate() {
    setEditingId(null);
    setName("");
    setTeacherId("");
    setSelectedParticipants([]);
    setParticipantQuery("");
    setParticipantResults([]);
    setPendingMove(null);
    setUploading(false);
    setUploadMessage("");
    setUploadError("");
    setPendingBulkMove(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(cls: ClassRow) {
    setEditingId(cls.id);
    setName(cls.name);
    setTeacherId(cls.teacherId);
    setSelectedParticipants(
      cls.participants.map((p) => ({
        id: p.participant.id,
        localParticipantId: p.participant.localParticipantId,
        name: p.participant.name,
        gradeLevel: p.participant.gradeLevel,
      }))
    );
    setParticipantQuery("");
    setParticipantResults([]);
    setPendingMove(null);
    setUploading(false);
    setUploadMessage("");
    setUploadError("");
    setPendingBulkMove(null);
    setError("");
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setName("");
    setTeacherId("");
    setSelectedParticipants([]);
    setParticipantQuery("");
    setParticipantResults([]);
    setPendingMove(null);
    setUploading(false);
    setUploadMessage("");
    setUploadError("");
    setPendingBulkMove(null);
    setError("");
  }

  async function searchParticipants(q: string) {
    setParticipantQuery(q);
    if (!q.trim()) {
      setParticipantResults([]);
      return;
    }
    setSearchingParticipants(true);
    try {
      const res = await fetch(`/api/participants?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setParticipantResults(data);
      }
    } catch {
      // keep prior results on network failure
    }
    setSearchingParticipants(false);
  }

  function addParticipant(p: SelectedParticipant) {
    const otherClass = classes.find(
      (cls) =>
        cls.id !== editingId &&
        cls.participants.some((cp) => cp.participant.id === p.id)
    );

    if (otherClass) {
      setPendingMove({ participants: [p], fromClass: otherClass.name });
      return;
    }

    setSelectedParticipants((prev) => {
      if (prev.some((x) => x.id === p.id)) return prev;
      return [...prev, p];
    });
    setParticipantQuery("");
    setParticipantResults([]);
  }

  function confirmMove() {
    if (!pendingMove) return;
    setSelectedParticipants((prev) => {
      const ids = new Set(pendingMove.participants.map((p) => p.id));
      const filtered = prev.filter((p) => !ids.has(p.id));
      return [...filtered, ...pendingMove.participants];
    });
    setPendingMove(null);
    setParticipantQuery("");
    setParticipantResults([]);
  }

  function cancelMove() {
    setPendingMove(null);
    setParticipantQuery("");
    setParticipantResults([]);
  }

  function removeParticipant(id: string) {
    setSelectedParticipants((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleRosterUpload(file: File) {
    setUploading(true);
    setUploadError("");
    setUploadMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/sunday-school/resolve-upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || "Failed to read the uploaded file.");
        setUploading(false);
        return;
      }

      const matched = (data.matched ?? []) as SelectedParticipant[];
      const notFound = (data.notFound ?? []) as string[];

      const conflicts: { name: string; fromClass: string }[] = [];
      for (const p of matched) {
        const otherClass = classes.find(
          (cls) =>
            cls.id !== editingId &&
            cls.participants.some((cp) => cp.participant.id === p.id)
        );
        if (otherClass) {
          conflicts.push({ name: p.name, fromClass: otherClass.name });
        }
      }

      if (conflicts.length > 0) {
        setPendingBulkMove({ participants: matched, conflicts });
      } else {
        setSelectedParticipants(matched);
        setUploadMessage(
          `Matched ${matched.length} participant${matched.length !== 1 ? "s" : ""}.`
        );
      }

      if (notFound.length > 0) {
        setUploadError(
          `Skipped ${notFound.length} ID${notFound.length !== 1 ? "s" : ""} not found: ${notFound.join(", ")}`
        );
      }
    } catch {
      setUploadError("Network error while reading the uploaded file.");
    }

    setUploading(false);
  }

  function confirmBulkMove() {
    if (!pendingBulkMove) return;
    setSelectedParticipants(pendingBulkMove.participants);
    setPendingBulkMove(null);
    setUploadMessage(
      `Matched ${pendingBulkMove.participants.length} participant${
        pendingBulkMove.participants.length !== 1 ? "s" : ""
      }.`
    );
  }

  function cancelBulkMove() {
    setPendingBulkMove(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");

    try {
      const res = await fetch(`/api/sunday-school/classes/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        setDeleteError(data.error || "Failed to delete class.");
        setDeleting(false);
        setDeleteTarget(null);
        return;
      }

      const listRes = await fetch("/api/sunday-school/classes");
      if (listRes.ok) {
        const listData = await listRes.json();
        setClasses(listData.classes);
      }

      setDeleteTarget(null);
      router.refresh();
    } catch {
      setDeleteError("Network error while deleting.");
      setDeleteTarget(null);
    }

    setDeleting(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Class name is required.");
      return;
    }
    if (!teacherId) {
      setError("Please select a teacher.");
      return;
    }

    setSaving(true);
    setError("");

    const body = {
      name: name.trim(),
      teacherId,
      participantIds: selectedParticipants.map((p) => p.id),
    };

    try {
      const res = await fetch(editingId ? `/api/sunday-school/classes/${editingId}` : "/api/sunday-school/classes", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save class.");
        setSaving(false);
        return;
      }

      // Re-fetch classes to reflect participant moves/assignments accurately.
      const listRes = await fetch("/api/sunday-school/classes");
      if (listRes.ok) {
        const listData = await listRes.json();
        setClasses(listData.classes);
      }

      setShowForm(false);
      setEditingId(null);
      setName("");
      setTeacherId("");
      setSelectedParticipants([]);
      router.refresh();
    } catch {
      setError("Network error while saving.");
    }
    setSaving(false);
  }

  async function handleExport() {
    const [y, m] = exportMonth.split("-").map(Number);
    setExporting(true);
    setExportError("");

    try {
      const res = await fetch(`/api/sunday-school/export?year=${y}&month=${m}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setExportError(data.error || "Export failed.");
        setExporting(false);
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : `sunday-school-attendance-${y}-${String(m).padStart(2, "0")}.xlsx`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Network error while exporting.");
    }
    setExporting(false);
  }

  return (
    <div className="page-container" style={{ maxWidth: 1080 }}>
      <h1 className="page-title" style={{ marginBottom: "0.5rem" }}>
        Sunday School
      </h1>
      <p className="text-muted mb-2" style={{ fontSize: "0.85rem" }}>
        Manage Sunday School classes, teachers, and participant assignments. Download monthly attendance reports.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", marginBottom: "1.25rem" }}>
        {!showForm && (
          <button onClick={openCreate} className="btn btn-primary">
            + Add Class
          </button>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginLeft: "auto" }}>
          <select
            value={exportMonth}
            onChange={(e) => setExportMonth(e.target.value)}
            className="form-select"
            style={{ minWidth: 180 }}
            aria-label="Export month"
          >
            {SUNDAY_SCHOOL_EXPORT_MONTH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button onClick={handleExport} disabled={exporting} className="btn btn-secondary">
            {exporting ? "Exporting…" : "Export Attendance"}
          </button>
        </div>
      </div>

      {exportError && (
        <div className="form-error mb-2" role="alert">
          {exportError}
        </div>
      )}

      {showForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 120,
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
            onClick={saving ? undefined : cancelForm}
          />
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "relative",
              background: "#FAF7F0",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.4)",
              boxShadow: "0 20px 40px rgba(31, 107, 77, 0.25)",
              borderTop: "4px solid #D9A441",
              maxWidth: 640,
              width: "calc(100% - 2rem)",
              maxHeight: "85vh",
              overflowY: "auto",
              margin: "0 1rem",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 style={{ margin: 0, color: "var(--color-brand)", fontSize: "1.05rem", fontWeight: 700 }}>
                {editingId ? "Edit Class" : "New Class"}
              </h3>
              <button
                type="button"
                onClick={cancelForm}
                disabled={saving}
                style={{
                  background: "none",
                  border: "none",
                  cursor: saving ? "default" : "pointer",
                  fontSize: "1.5rem",
                  color: "#1F6B4D",
                  lineHeight: 1,
                  padding: "0.25rem",
                  opacity: saving ? 0.6 : 1,
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSave}>

            <div className="grid-2-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label className="form-label">Class Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Class A"
                  required
                />
              </div>
              <div>
                <label className="form-label">Teacher</label>
                <select
                  className="form-select"
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  required
                >
                  <option value="">Select a teacher…</option>
                  {initialTeachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginTop: "0.75rem" }}>
              <label className="form-label">Participants</label>
              <p className="form-hint" style={{ marginTop: 0, marginBottom: "0.5rem" }}>
                Search by name or ID, or upload a class roster (.xlsx). Assigning a participant already in another class moves them to this class.
              </p>

              <div style={{ marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <input
                    type="file"
                    accept=".xlsx"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleRosterUpload(file);
                        e.target.value = "";
                      }
                    }}
                  />
                  {uploading && <span className="text-muted text-sm">Reading file…</span>}
                </div>
                <p className="form-hint" style={{ margin: "0.35rem 0 0" }}>
                  Column A: Local Participant ID, Column B: Name. First row is a header. Uploading replaces the current roster.
                </p>
                {uploadMessage && <p className="form-success" style={{ margin: "0.35rem 0 0" }}>{uploadMessage}</p>}
                {uploadError && <p className="form-error" style={{ margin: "0.35rem 0 0" }}>{uploadError}</p>}
              </div>

              <input
                type="text"
                className="form-input"
                value={participantQuery}
                onChange={(e) => searchParticipants(e.target.value)}
                placeholder="Search participants…"
              />

              {searchingParticipants && <p className="text-muted text-sm" style={{ margin: "0.5rem 0" }}>Searching…</p>}

              {participantResults.length > 0 && (
                <div style={{ border: "1px solid var(--color-border)", borderRadius: "0.5rem", marginTop: "0.5rem", maxHeight: 240, overflowY: "auto" }}>
                  {participantResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addParticipant(p)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "0.6rem 0.75rem",
                        background: "none",
                        border: "none",
                        borderBottom: "1px solid var(--color-border-light)",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontSize: "0.875rem",
                      }}
                    >
                      <strong>{p.name}</strong>
                      <span className="text-muted" style={{ marginLeft: "0.5rem", fontSize: "0.75rem" }}>
                        {p.localParticipantId}
                        {p.gradeLevel ? ` · ${p.gradeLevel}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {selectedParticipants.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.75rem" }}>
                  {selectedParticipants.map((p) => (
                    <span
                      key={p.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        padding: "0.35rem 0.7rem",
                        background: "rgba(31,107,77,0.08)",
                        border: "1px solid rgba(31,107,77,0.25)",
                        borderRadius: "999px",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "#1F6B4D",
                      }}
                    >
                      {p.name}
                      <button
                        type="button"
                        onClick={() => removeParticipant(p.id)}
                        aria-label={`Remove ${p.name}`}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "inherit",
                          fontSize: "1rem",
                          lineHeight: 1,
                          padding: 0,
                        }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="form-error mb-1" style={{ marginTop: "0.75rem" }}>{error}</p>}

            <div className="flex-row gap-sm" style={{ marginTop: "1rem" }}>
              <button type="submit" disabled={saving} className="btn btn-success">
                {saving ? "Saving…" : "Save Class"}
              </button>
              <button type="button" onClick={cancelForm} className="btn btn-ghost">
                Cancel
              </button>
            </div>
            </form>
          </div>
        </div>
      )}

      {classes.length === 0 ? (
        <Card>
          <p className="text-muted text-center" style={{ padding: "1rem 0", margin: 0 }}>
            No Sunday School classes yet. Add one to get started.
          </p>
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-responsive">
            <table className="table-card" style={{ boxShadow: "none", border: "none", borderRadius: 0 }}>
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Teacher</th>
                  <th style={{ textAlign: "center" }}>Participants</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((cls) => (
                  <tr key={cls.id}>
                    <td data-label="Class" style={{ fontWeight: 700, color: "#1F6B4D" }}>{cls.name}</td>
                    <td data-label="Teacher">{cls.teacher.name}</td>
                    <td data-label="Participants" style={{ textAlign: "center" }}>
                      {cls.participants.length}
                    </td>
                    <td data-label="Actions" style={{ whiteSpace: "nowrap" }}>
                      <div className="flex-row gap-sm">
                        <button onClick={() => openEdit(cls)} className="btn btn-primary btn-sm">
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setDeleteError("");
                            setDeleteTarget(cls);
                          }}
                          className="btn btn-danger btn-sm"
                        >
                          Delete
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

      {deleteError && (
        <div className="form-error mb-2" role="alert">
          {deleteError}
        </div>
      )}

      <ConfirmDialog
        open={pendingMove !== null}
        title="Move participant to this class?"
        message={
          <>
            <strong>{pendingMove?.participants[0]?.name}</strong> is currently assigned to{" "}
            <strong>{pendingMove?.fromClass}</strong>. Saving will move them to this class.
          </>
        }
        confirmLabel="Move"
        cancelLabel="Cancel"
        onConfirm={confirmMove}
        onCancel={cancelMove}
      />

      <ConfirmDialog
        open={pendingBulkMove !== null}
        title="Assign uploaded participants?"
        message={
          <>
            <p style={{ margin: "0 0 0.5rem" }}>
              The following participants are currently assigned to other classes and will be moved:
            </p>
            <ul style={{ margin: "0 0 0.5rem", paddingLeft: "1.25rem" }}>
              {pendingBulkMove?.conflicts.map((c, i) => (
                <li key={i}>
                  <strong>{c.name}</strong> (from {c.fromClass})
                </li>
              ))}
            </ul>
            <p style={{ margin: 0 }}>
              Saving will replace this class&rsquo;s roster with the {pendingBulkMove?.participants.length} matched
              participant{pendingBulkMove?.participants.length === 1 ? "" : "s"} from the file.
            </p>
          </>
        }
        confirmLabel="Assign"
        cancelLabel="Cancel"
        onConfirm={confirmBulkMove}
        onCancel={cancelBulkMove}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete class?"
        destructive
        busy={deleting}
        message={
          <>
            Delete <strong>{deleteTarget?.name}</strong>? Participants in this class will become unassigned, not
            deleted. Classes with attendance records cannot be deleted.
          </>
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
