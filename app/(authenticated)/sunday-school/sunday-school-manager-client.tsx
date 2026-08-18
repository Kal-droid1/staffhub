"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/modules/core/components/card";
import ConfirmDialog from "@/modules/core/components/confirm-dialog";
import { MonthGridPicker } from "@/modules/core/components";
import {
  getCurrentSundaySchoolExportMonthValue,
  getCurrentSundaySchoolPeriod,
  getSundaySchoolExportMonthOptions,
} from "@/modules/sunday-school/export-months";

interface TeacherOption {
  id: string;
  name: string;
  username: string;
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

interface HistoryWeek {
  week: number;
  presentCount: number;
  absentCount: number;
  status: "not_started" | "in_progress" | "submitted";
  submittedAt: string | null;
}

interface SubmissionSummaryRow {
  classId: string;
  name: string;
  teacherName: string;
  participantCount: number;
  status: "not_started" | "in_progress" | "submitted";
}

interface ChronicAbsenceRow {
  participantId: string;
  name: string;
  localParticipantId: string;
  className: string | null;
  absenceCount: number;
}

function formatHistoryDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Addis_Ababa",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
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
    conflicts: { id: string; name: string; fromClass: string }[];
  } | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<ClassRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Export state
  const [exportMonth, setExportMonth] = useState(getCurrentSundaySchoolExportMonthValue());
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  // Submission summary state
  const [summaryPeriod, setSummaryPeriod] = useState(() => {
    const p = getCurrentSundaySchoolPeriod();
    return { year: p.year, month: p.month, week: p.week };
  });
  const [summary, setSummary] = useState<SubmissionSummaryRow[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  // Chronic absences state
  const [absenceThreshold, setAbsenceThreshold] = useState(3);
  const [absences, setAbsences] = useState<ChronicAbsenceRow[]>([]);
  const [absencesLoading, setAbsencesLoading] = useState(false);
  const [absencesError, setAbsencesError] = useState("");

  const realPeriod = useMemo(() => getCurrentSundaySchoolPeriod(), []);

  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    setSummaryError("");
    (async () => {
      try {
        const res = await fetch(
          `/api/sunday-school/submission-summary?year=${summaryPeriod.year}&month=${summaryPeriod.month}&week=${summaryPeriod.week}`
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setSummaryError(
            data && typeof data === "object" && "error" in data
              ? String(data.error)
              : "Failed to load submission status."
          );
          setSummary([]);
        } else {
          setSummary(data.classes ?? []);
        }
      } catch {
        if (!cancelled) {
          setSummaryError("Network error while loading submission status.");
          setSummary([]);
        }
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [summaryPeriod]);

  useEffect(() => {
    let cancelled = false;
    setAbsencesLoading(true);
    setAbsencesError("");
    (async () => {
      try {
        const res = await fetch(`/api/sunday-school/chronic-absences?minAbsences=${absenceThreshold}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setAbsencesError(
            data && typeof data === "object" && "error" in data
              ? String(data.error)
              : "Failed to load absence data."
          );
          setAbsences([]);
        } else {
          setAbsences(data.participants ?? []);
        }
      } catch {
        if (!cancelled) {
          setAbsencesError("Network error while loading absence data.");
          setAbsences([]);
        }
      } finally {
        if (!cancelled) setAbsencesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [absenceThreshold]);

  // Attendance history state
  const [historyTarget, setHistoryTarget] = useState<ClassRow | null>(null);
  const [historyYear, setHistoryYear] = useState(0);
  const [historyMonth, setHistoryMonth] = useState(0);
  const [historyTeacherName, setHistoryTeacherName] = useState("");
  const [historyWeeks, setHistoryWeeks] = useState<HistoryWeek[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  async function loadHistory(classId: string, y: number, m: number) {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const res = await fetch(`/api/sunday-school/classes/${classId}/attendance?year=${y}&month=${m}`);
      const data = await res.json();
      if (!res.ok) {
        setHistoryError(data && typeof data === "object" && "error" in data ? String(data.error) : "Failed to load attendance history.");
        setHistoryWeeks([]);
      } else {
        setHistoryWeeks(data.weeks ?? []);
        setHistoryTeacherName(data.teacher?.name ?? "");
      }
    } catch {
      setHistoryError("Network error while loading attendance history.");
      setHistoryWeeks([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openAttendanceHistory(cls: ClassRow) {
    const period = getCurrentSundaySchoolPeriod();
    setHistoryTarget(cls);
    setHistoryYear(period.year);
    setHistoryMonth(period.month);
    setHistoryTeacherName(cls.teacher.name);
    setHistoryError("");
    await loadHistory(cls.id, period.year, period.month);
  }

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
      const notFound = (data.notFound ?? []) as { id: string; name: string }[];

      const conflicts: { id: string; name: string; fromClass: string }[] = [];
      for (const p of matched) {
        const otherClass = classes.find(
          (cls) =>
            cls.id !== editingId &&
            cls.participants.some((cp) => cp.participant.id === p.id)
        );
        if (otherClass) {
          conflicts.push({ id: p.id, name: p.name, fromClass: otherClass.name });
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
        const skipped = notFound
          .map((row) => {
            const displayName = row.name.trim();
            return displayName
              ? `${displayName} (${row.id})`
              : row.id;
          })
          .join(", ");

        setUploadError(
          `Skipped ${notFound.length} not found: ${skipped}`
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
    if (!pendingBulkMove) return;
    const conflictIds = new Set(pendingBulkMove.conflicts.map((c) => c.id));
    const assigned = pendingBulkMove.participants.filter((p) => !conflictIds.has(p.id));
    setSelectedParticipants(assigned);
    setPendingBulkMove(null);
    setUploadMessage(
      `Assigned ${assigned.length} participant${assigned.length !== 1 ? "s" : ""}${
        pendingBulkMove.conflicts.length > 0
          ? `; skipped ${pendingBulkMove.conflicts.length} already assigned to another class.`
          : "."
      }`
    );
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

  const summaryGroups = [
    {
      key: "not_started",
      label: "Not yet submitted",
      icon: "radio_button_unchecked",
      color: "#B23B3B",
      bg: "#FDF0F0",
      border: "rgba(214,69,69,0.25)",
      items: summary.filter((c) => c.status === "not_started"),
    },
    {
      key: "in_progress",
      label: "In progress",
      icon: "edit_note",
      color: "#8A5A00",
      bg: "#FDF3E3",
      border: "#EED9B0",
      items: summary.filter((c) => c.status === "in_progress"),
    },
    {
      key: "submitted",
      label: "Submitted",
      icon: "check_circle",
      color: "#1F6B4D",
      bg: "#EFF7F3",
      border: "rgba(31,107,77,0.25)",
      items: summary.filter((c) => c.status === "submitted"),
    },
  ].filter((g) => g.items.length > 0);

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

        <Link href="/sunday-school/trash" className="btn btn-ghost">
          Trash
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginLeft: "auto" }}>
          <select
            value={exportMonth}
            onChange={(e) => setExportMonth(e.target.value)}
            className="form-select"
            style={{ minWidth: 180 }}
            aria-label="Export month"
          >
            {getSundaySchoolExportMonthOptions().map((o) => (
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

      <Card style={{ marginBottom: "1.25rem" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "0.75rem",
            marginBottom: "0.75rem",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--color-brand)" }}>
              Submission status
            </h2>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
              Which classes have submitted attendance for the selected week
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "0.6rem", flexWrap: "wrap" }}>
            <div style={{ width: 160 }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: "var(--color-brand)",
                  marginBottom: "0.3rem",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Month
              </label>
              <MonthGridPicker
                value={`${summaryPeriod.year}-${summaryPeriod.month}`}
                onChange={(y, m) => setSummaryPeriod((prev) => ({ ...prev, year: y, month: m }))}
              />
            </div>
            <div style={{ width: 130 }}>
              <label
                htmlFor="summary-week"
                style={{
                  display: "block",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: "var(--color-brand)",
                  marginBottom: "0.3rem",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Week
              </label>
              <select
                id="summary-week"
                value={summaryPeriod.week}
                onChange={(e) => setSummaryPeriod((prev) => ({ ...prev, week: Number(e.target.value) }))}
                className="form-select"
              >
                {[1, 2, 3, 4, 5].map((w) => {
                  const isToday =
                    summaryPeriod.year === realPeriod.year &&
                    summaryPeriod.month === realPeriod.month &&
                    w === realPeriod.week;
                  return (
                    <option key={w} value={w}>
                      {isToday ? `Week ${w} (Today)` : `Week ${w}`}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        {summaryError && (
          <div className="form-error mb-2" role="alert">
            {summaryError}
          </div>
        )}

        {summaryLoading ? (
          <div style={{ textAlign: "center", padding: "1.25rem 0", color: "var(--color-text-muted)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "1.5rem", opacity: 0.6 }}>hourglass_top</span>
            <p style={{ margin: "0.4rem 0 0", fontSize: "0.85rem" }}>Loading…</p>
          </div>
        ) : summary.length === 0 ? (
          <p className="text-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            No classes with participants for this week.
          </p>
        ) : summaryGroups.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.7rem 0.85rem",
              borderRadius: "0.6rem",
              background: "#EFF7F3",
              border: "1px solid rgba(31,107,77,0.25)",
              color: "#1F6B4D",
              fontSize: "0.875rem",
              fontWeight: 800,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>check_circle</span>
            All {summary.length} class{summary.length === 1 ? "" : "es"} submitted for Week {summaryPeriod.week}.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {summaryGroups.map((g) => (
              <div
                key={g.key}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.6rem",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "0.6rem",
                  background: g.bg,
                  border: `1px solid ${g.border}`,
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ color: g.color, fontSize: "1.15rem", marginTop: "0.1rem", flexShrink: 0 }}
                >
                  {g.icon}
                </span>
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      color: g.color,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {g.label} ({g.items.length})
                  </p>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.875rem", color: "#2B2B2B", lineHeight: 1.45 }}>
                    {g.items.map((c) => c.name).join(", ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card style={{ marginBottom: "1.25rem" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "0.75rem",
            marginBottom: "0.75rem",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--color-brand)" }}>
              Chronic absences
            </h2>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
              Participants with repeated absences in the last 5 weeks — for family follow-up. Only submitted
              &ldquo;Absent&rdquo; records are counted.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <label htmlFor="absence-threshold" className="text-muted text-sm" style={{ fontWeight: 700 }}>
              Absences ≥
            </label>
            <input
              id="absence-threshold"
              type="number"
              min={1}
              max={20}
              value={absenceThreshold}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isInteger(v) && v >= 1 && v <= 20) setAbsenceThreshold(v);
              }}
              className="form-input"
              style={{ width: 72, minHeight: 36, textAlign: "center" }}
              aria-label="Minimum absences threshold"
            />
          </div>
        </div>

        {absencesError && (
          <div className="form-error mb-2" role="alert">
            {absencesError}
          </div>
        )}

        {absencesLoading ? (
          <div style={{ textAlign: "center", padding: "1.25rem 0", color: "var(--color-text-muted)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "1.5rem", opacity: 0.6 }}>hourglass_top</span>
            <p style={{ margin: "0.4rem 0 0", fontSize: "0.85rem" }}>Loading…</p>
          </div>
        ) : absences.length === 0 ? (
          <p className="text-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            No participants with {absenceThreshold} or more absences in the last 5 weeks.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {absences.map((a) => (
              <div
                key={a.participantId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  padding: "0.65rem 0.75rem",
                  borderRadius: "0.6rem",
                  background: "#FDF0F0",
                  border: "1px solid rgba(214,69,69,0.2)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 800, color: "#2B2B2B" }}>{a.name}</p>
                  <p
                    style={{
                      margin: "0.15rem 0 0",
                      fontSize: "0.75rem",
                      color: "var(--color-text-muted)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {a.localParticipantId}
                    {a.className ? ` · ${a.className}` : ""}
                  </p>
                </div>
                <span
                  style={{
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    padding: "0.25rem 0.6rem",
                    borderRadius: "999px",
                    background: "#FDF0F0",
                    color: "#B23B3B",
                    border: "1px solid rgba(214,69,69,0.3)",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "0.9rem" }}>close</span>
                  {a.absenceCount} absent
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

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
                      {t.name} ({t.username})
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
                  The ID and Name columns are detected automatically from the file&rsquo;s header row. Uploading replaces the current roster.
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
                    <td data-label="Class">
                      <button
                        type="button"
                        onClick={() => openAttendanceHistory(cls)}
                        title="View attendance history"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "0.25rem 0.15rem",
                          borderRadius: "0.4rem",
                          fontFamily: "inherit",
                          fontWeight: 700,
                          color: "#1F6B4D",
                          fontSize: "1rem",
                          textAlign: "left",
                          transition: "background 0.15s, text-decoration 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(31,107,77,0.08)";
                          e.currentTarget.style.textDecoration = "underline";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "none";
                          e.currentTarget.style.textDecoration = "none";
                        }}
                      >
                        {cls.name}
                      </button>
                    </td>
                    <td data-label="Teacher">{cls.teacher.name}</td>
                    <td data-label="Participants" style={{ textAlign: "center" }}>
                      {cls.participants.length}
                    </td>
                    <td data-label="Actions" style={{ whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <button
                          type="button"
                          onClick={() => openEdit(cls)}
                          title="Edit"
                          aria-label={`Edit ${cls.name}`}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "0.5rem",
                            borderRadius: "0.5rem",
                            color: "var(--color-text-muted)",
                            transition: "all 0.15s",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = "#1F6B4D";
                            e.currentTarget.style.background = "rgba(31,107,77,0.08)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = "var(--color-text-muted)";
                            e.currentTarget.style.background = "none";
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "1.375rem" }}>edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError("");
                            setDeleteTarget(cls);
                          }}
                          title="Delete"
                          aria-label={`Delete ${cls.name}`}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "0.5rem",
                            borderRadius: "0.5rem",
                            color: "var(--color-text-muted)",
                            transition: "all 0.15s",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = "#D64545";
                            e.currentTarget.style.background = "rgba(214,69,69,0.08)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = "var(--color-text-muted)";
                            e.currentTarget.style.background = "none";
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "1.375rem" }}>delete</span>
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
            <p style={{ margin: "0.5rem 0 0" }}>
              Cancel assigns everyone except the {pendingBulkMove?.conflicts.length} listed above.
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
            Move <strong>{deleteTarget?.name}</strong> to trash? Its participants will become unassigned and it can
            be restored later. Attendance records are preserved.
          </>
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {historyTarget && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 150, background: "rgba(0,0,0,0.4)" }}
            onClick={() => setHistoryTarget(null)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Attendance history for ${historyTarget.name}`}
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 151,
              width: "min(560px, calc(100vw - 1.5rem))",
              maxHeight: "85vh",
              overflowY: "auto",
              background: "#FFFFFF",
              borderRadius: "1rem",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              padding: "1.25rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--color-brand)" }}>
                  Attendance history
                </h2>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", fontWeight: 700, color: "#2B2B2B" }}>
                  {historyTarget.name}
                </p>
                <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                  Teacher: {historyTeacherName || historyTarget.teacher.name} · Read-only
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryTarget(null)}
                aria-label="Close"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1.5rem",
                  color: "var(--color-brand)",
                  lineHeight: 1,
                  padding: "0.25rem",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ margin: "1rem 0" }}>
              <MonthGridPicker
                value={`${historyYear}-${historyMonth}`}
                onChange={(y, m) => {
                  setHistoryYear(y);
                  setHistoryMonth(m);
                  loadHistory(historyTarget.id, y, m);
                }}
              />
            </div>

            {historyError && (
              <div className="form-error mb-2" role="alert">
                {historyError}
              </div>
            )}

            {historyLoading ? (
              <div style={{ textAlign: "center", padding: "1.5rem 0", color: "var(--color-text-muted)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "1.75rem", opacity: 0.6 }}>hourglass_top</span>
                <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem" }}>Loading…</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {historyWeeks.map((w) => {
                  const isSubmitted = w.status === "submitted";
                  const isInProgress = w.status === "in_progress";
                  const badgeColor = isSubmitted ? "#1F6B4D" : isInProgress ? "#8A5A00" : "#6B7280";
                  const badgeBg = isSubmitted ? "#EFF7F3" : isInProgress ? "#FDF3E3" : "#F1EFEA";
                  const badgeIcon = isSubmitted ? "check_circle" : isInProgress ? "edit_note" : "radio_button_unchecked";
                  const badgeLabel = isSubmitted ? "Submitted" : isInProgress ? "In progress" : "Not started";
                  return (
                    <div
                      key={w.week}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.75rem",
                        padding: "0.75rem 0.85rem",
                        borderRadius: "0.6rem",
                        background: badgeBg,
                        border: isSubmitted ? "1px solid rgba(31,107,77,0.25)" : isInProgress ? "1px solid #EED9B0" : "1px solid var(--color-border)",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 800, color: "#2B2B2B" }}>
                          Week {w.week}
                        </p>
                        <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                          {isSubmitted
                            ? `${w.presentCount} present · ${w.absentCount} absent`
                            : isInProgress
                              ? `${w.presentCount} present · ${w.absentCount} absent so far`
                              : "No attendance recorded"}
                          {w.submittedAt ? ` · Submitted ${formatHistoryDate(w.submittedAt)}` : ""}
                        </p>
                      </div>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          flexShrink: 0,
                          padding: "0.25rem 0.6rem",
                          borderRadius: "999px",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          color: badgeColor,
                          background: badgeBg,
                          border: `1px solid ${badgeColor}33`,
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "0.95rem" }}>{badgeIcon}</span>
                        {badgeLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
              <button type="button" onClick={() => setHistoryTarget(null)} className="btn btn-ghost">
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
