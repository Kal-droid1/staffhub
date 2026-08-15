"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/modules/core/components/card";
import ConfirmDialog from "@/modules/core/components/confirm-dialog";

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

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

  // Export state
  const [exportMonth, setExportMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}`;
  });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const exportMonthOptions = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const options: { value: string; label: string }[] = [];
    for (let y = year - 1; y <= year + 1; y++) {
      for (let m = 1; m <= 12; m++) {
        options.push({ value: `${y}-${m}`, label: `${MONTH_NAMES[m - 1]} ${y}` });
      }
    }
    return options;
  }, []);

  function openCreate() {
    setEditingId(null);
    setName("");
    setTeacherId("");
    setSelectedParticipants([]);
    setParticipantQuery("");
    setParticipantResults([]);
    setPendingMove(null);
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
            {exportMonthOptions.map((o) => (
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
        <Card style={{ marginBottom: "1.5rem" }}>
          <form onSubmit={handleSave}>
            <h3 style={{ marginTop: 0, color: "var(--color-brand)", fontSize: "1rem" }}>
              {editingId ? "Edit Class" : "New Class"}
            </h3>

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
                Search by name or ID. Assigning a participant already in another class moves them to this class.
              </p>

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
        </Card>
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
                      <button onClick={() => openEdit(cls)} className="btn btn-primary btn-sm">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
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
    </div>
  );
}
