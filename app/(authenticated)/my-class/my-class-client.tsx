"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SUNDAY_SCHOOL_FIRST_EXPORT_MONTH,
  getSundaySchoolExportMonthOptions,
  MONTH_NAMES,
} from "@/modules/sunday-school/export-months";

interface ClassOption {
  id: string;
  name: string;
  teacherId: string;
  teacherName?: string | null;
  isSubstituteCoverage?: boolean;
}

interface TeacherOption {
  id: string;
  name: string;
  email: string;
}

interface CoverageArrangement {
  id: string;
  class: { id: string; name: string };
  substitute: { id: string; name: string };
  weeks: { year: number; month: number; week: number }[];
  createdAt: string;
}

interface RosterRow {
  participantId: string;
  localParticipantId: string;
  name: string;
  gradeLevel: string | null;
  present: boolean | null;
}

interface RosterResponse {
  classInfo: { id: string; name: string } | null;
  year: number;
  month: number;
  week: number;
  roster: RosterRow[];
  submittedAt: string | null;
  submittedByName: string | null;
}

const WEEK_LABELS = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"];

const COLORS = {
  teal: "#1F6B4D",
  amber: "#D9A441",
  cream: "#FAF7F0",
  danger: "#D64545",
  muted: "#6B7280",
  border: "#E8E3D9",
};

function formatSubmittedAt(value: string | null): string {
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

function formatCoverageWeeks(weeks: { year: number; month: number; week: number }[]): string {
  if (weeks.length === 0) return "";
  const byMonth = new Map<string, number[]>();
  for (const w of weeks) {
    const key = `${w.year}-${w.month}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(w.week);
  }
  const parts: string[] = [];
  for (const [key, ws] of byMonth) {
    const [y, m] = key.split("-").map(Number);
    const sorted = [...ws].sort((a, b) => a - b);
    const label =
      sorted.length === 1
        ? `Week ${sorted[0]}`
        : `Weeks ${sorted[0]}–${sorted[sorted.length - 1]}`;
    parts.push(`${label} · ${MONTH_NAMES[m - 1]} ${y}`);
  }
  return parts.join(", ");
}

export default function MyClassClient({
  initialClasses,
  initialCoveredClasses,
  initialTeachers,
  initialUserId,
  initialYear,
  initialMonth,
  initialWeek,
}: {
  initialClasses: ClassOption[];
  initialCoveredClasses: ClassOption[];
  initialTeachers: TeacherOption[];
  initialUserId: string;
  initialYear: number;
  initialMonth: number;
  initialWeek: number;
}) {
  const [classId, setClassId] = useState<string>(() => {
    if (initialClasses[0]) return initialClasses[0].id;
    return initialCoveredClasses[0]?.id ?? "";
  });
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [week, setWeek] = useState(initialWeek);
  const [query, setQuery] = useState("");
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<string>>(new Set());
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [submittedByName, setSubmittedByName] = useState<string | null>(null);

  const [coveredClasses, setCoveredClasses] = useState<ClassOption[]>(initialCoveredClasses);

  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [classInfo, setClassInfo] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const [coverageOpen, setCoverageOpen] = useState(false);
  const [arrangements, setArrangements] = useState<CoverageArrangement[]>([]);
  const [formClassId, setFormClassId] = useState("");
  const [formSubstituteId, setFormSubstituteId] = useState("");
  const [formMonthValue, setFormMonthValue] = useState("");
  const [formWeekStart, setFormWeekStart] = useState(1);
  const [formWeekEnd, setFormWeekEnd] = useState(1);
  const [arrangeError, setArrangeError] = useState("");
  const [arrangeSaving, setArrangeSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const monthOptions = useMemo(() => getSundaySchoolExportMonthOptions(), []);

  const safeMonthValue = monthOptions.some((o) => o.value === `${year}-${month}`)
    ? `${year}-${month}`
    : SUNDAY_SCHOOL_FIRST_EXPORT_MONTH;

  const currentKey = `${classId}-${year}-${month}-${week}`;
  const isCollapsed = collapsedWeeks.has(currentKey);

  const allClasses = useMemo(() => {
    const map = new Map<string, ClassOption>();
    for (const c of initialClasses) {
      map.set(c.id, { ...c, isSubstituteCoverage: false, teacherName: null });
    }
    for (const c of coveredClasses) {
      if (!map.has(c.id)) {
        map.set(c.id, { ...c, isSubstituteCoverage: true });
      }
    }
    return Array.from(map.values());
  }, [initialClasses, coveredClasses]);

  const selectedClass = allClasses.find((c) => c.id === classId);

  const loadRoster = useCallback(
    async (selectedClassId: string, selectedYear: number, selectedMonth: number, selectedWeek: number) => {
      if (!selectedClassId) {
        setRoster([]);
        setClassInfo(null);
        setError("");
        return;
      }

      setLoading(true);
      setError("");
      setBanner(null);
      setJustSubmitted(false);
      setQuery("");
      setSubmittedAt(null);
      setSubmittedByName(null);

      try {
        const res = await fetch(
          `/api/sunday-school/my-class/roster?classId=${encodeURIComponent(selectedClassId)}&year=${selectedYear}&month=${selectedMonth}&week=${selectedWeek}`
        );
        const data: RosterResponse = await res.json();

        if (!res.ok) {
          setError(data && typeof data === "object" && "error" in data ? String(data.error) : "Failed to load roster");
          setRoster([]);
          setClassInfo(null);
        } else {
          setRoster(data.roster);
          setClassInfo(data.classInfo);
          setSubmittedAt(data.submittedAt ?? null);
          setSubmittedByName(data.submittedByName ?? null);
        }
      } catch {
        setError("Network error while loading roster.");
        setRoster([]);
        setClassInfo(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const refreshCoveredClasses = useCallback(async (y: number, m: number, w: number) => {
    try {
      const res = await fetch(
        `/api/sunday-school/my-class/coverage/classes?year=${y}&month=${m}&week=${w}`
      );
      const data = await res.json();
      if (res.ok) setCoveredClasses(data.classes ?? []);
    } catch {
      // Non-fatal: the roster endpoint enforces access anyway.
    }
  }, []);

  const refreshCoverages = useCallback(async () => {
    try {
      const res = await fetch("/api/sunday-school/my-class/coverage");
      const data = await res.json();
      if (res.ok) setArrangements(data.coverages ?? []);
    } catch {
      // Non-fatal.
    }
  }, []);

  useEffect(() => {
    loadRoster(classId, year, month, week);
  }, [classId, year, month, week, loadRoster]);

  useEffect(() => {
    setCoveredClasses([]);
    refreshCoveredClasses(year, month, week);
  }, [year, month, week, refreshCoveredClasses]);

  useEffect(() => {
    const ids = new Set(allClasses.map((c) => c.id));
    if (!classId || !ids.has(classId)) {
      setClassId(allClasses[0]?.id ?? "");
    }
  }, [allClasses, classId]);

  useEffect(() => {
    return () => {
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, []);

  function togglePresent(participantId: string, present: boolean) {
    setRoster((prev) =>
      prev.map((row) => (row.participantId === participantId ? { ...row, present } : row))
    );
    setBanner(null);
    setJustSubmitted(false);
  }

  async function handleSubmit() {
    if (!classId || roster.length === 0 || submitting) return;

    const unreviewedCount = roster.filter((r) => r.present === null).length;
    if (unreviewedCount > 0) {
      setError(`${unreviewedCount} kid${unreviewedCount === 1 ? "" : "s"} still need${unreviewedCount === 1 ? "s" : ""} a Present or Absent selection.`);
      setBanner(null);
      return;
    }

    setSubmitting(true);
    setError("");
    setBanner(null);

    try {
      const res = await fetch("/api/sunday-school/my-class/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          year,
          month,
          week,
          records: roster.map((r) => ({ participantId: r.participantId, present: r.present as boolean })),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data && typeof data === "object" && "error" in data ? String(data.error) : "Failed to save attendance");
        setJustSubmitted(false);
      } else {
        const absent = roster.filter((r) => r.present === false).length;
        const present = roster.length - absent;
        setBanner(`Saved — ${present} present, ${absent} absent`);
        setJustSubmitted(true);
        setSubmittedAt(
          data && typeof data === "object" && "submittedAt" in data
            ? String(data.submittedAt)
            : new Date().toISOString()
        );
        setSubmittedByName(null);
        setCollapsedWeeks((prev) => new Set(prev).add(currentKey));

        if (bannerTimer.current) clearTimeout(bannerTimer.current);
        bannerTimer.current = setTimeout(() => setBanner(null), 5000);
      }
    } catch {
      setError("Network error while saving attendance.");
      setJustSubmitted(false);
    } finally {
      setSubmitting(false);
    }
  }

  function openCoverageModal() {
    setFormClassId(initialClasses[0]?.id ?? "");
    setFormSubstituteId("");
    setFormMonthValue(safeMonthValue);
    setFormWeekStart(week);
    setFormWeekEnd(week);
    setArrangeError("");
    setCoverageOpen(true);
    refreshCoverages();
  }

  async function handleArrange() {
    if (!formClassId || !formSubstituteId || arrangeSaving) return;

    const [y, m] = formMonthValue.split("-").map(Number);
    if (!Number.isInteger(y) || !Number.isInteger(m)) {
      setArrangeError("Please pick a valid month.");
      return;
    }

    setArrangeSaving(true);
    setArrangeError("");
    try {
      const res = await fetch("/api/sunday-school/my-class/coverage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: formClassId,
          substituteId: formSubstituteId,
          year: y,
          month: m,
          weekStart: formWeekStart,
          weekEnd: formWeekEnd,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setArrangeError(
          data && typeof data === "object" && "error" in data ? String(data.error) : "Failed to arrange coverage."
        );
        return;
      }

      setCoverageOpen(false);
      setBanner("Coverage arranged — the substitute can now tick this class for the selected weeks.");
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      bannerTimer.current = setTimeout(() => setBanner(null), 5000);
      await Promise.all([refreshCoverages(), refreshCoveredClasses(year, month, week)]);
    } catch {
      setArrangeError("Network error while arranging coverage.");
    } finally {
      setArrangeSaving(false);
    }
  }

  async function handleCancelCoverage(id: string) {
    if (cancellingId) return;
    setCancellingId(id);
    setArrangeError("");
    try {
      const res = await fetch(`/api/sunday-school/my-class/coverage/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setArrangeError(
          data && typeof data === "object" && "error" in data ? String(data.error) : "Failed to cancel coverage."
        );
        return;
      }
      setArrangements((prev) => prev.filter((a) => a.id !== id));
      await refreshCoveredClasses(year, month, week);
    } catch {
      setArrangeError("Network error while cancelling coverage.");
    } finally {
      setCancellingId(null);
    }
  }

  const presentCount = roster.filter((r) => r.present === true).length;
  const absentCount = roster.filter((r) => r.present === false).length;
  const unreviewedCount = roster.filter((r) => r.present === null).length;

  const filteredRoster = query.trim()
    ? roster.filter((r) => {
        const q = query.trim().toLowerCase();
        return (
          r.name.toLowerCase().includes(q) ||
          r.localParticipantId.toLowerCase().includes(q)
        );
      })
    : roster;

  return (
    <div
      style={{
        minHeight: "100dvh",
        padding: "0 0.75rem calc(88px + env(safe-area-inset-bottom))",
        display: "flex",
        flexDirection: "column",
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      <div style={{ padding: "0.75rem 0 0.5rem" }}>
        <h1
          style={{
            fontSize: "1.35rem",
            fontWeight: 800,
            color: COLORS.teal,
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          My Class
        </h1>
        <p style={{ margin: "0.15rem 0 0", fontSize: "0.8125rem", color: COLORS.muted }}>
          Sunday School attendance
        </p>
      </div>

      {initialClasses.length > 0 && (
        <button
          type="button"
          onClick={openCoverageModal}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.4rem",
            minHeight: 46,
            marginBottom: "0.75rem",
            borderRadius: "0.75rem",
            border: `1px solid ${COLORS.teal}`,
            background: "#FFFFFF",
            color: COLORS.teal,
            fontWeight: 800,
            fontSize: "0.9rem",
            fontFamily: "inherit",
            cursor: "pointer",
            boxShadow: "0 1px 4px rgba(31,107,77,0.1)",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "1.15rem" }}>swap_horiz</span>
          Arrange coverage
        </button>
      )}

      {allClasses.length > 1 && (
        <div style={{ marginBottom: "0.6rem" }}>
          <label
            htmlFor="class-select"
            style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: COLORS.teal, marginBottom: "0.3rem", letterSpacing: "0.04em", textTransform: "uppercase" }}
          >
            Class
          </label>
          <select
            id="class-select"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            style={selectStyle}
          >
            {allClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.isSubstituteCoverage
                  ? `${c.name} (substitute for ${c.teacherName ?? "another teacher"})`
                  : c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "0.6rem", marginBottom: "0.75rem" }}>
        <div style={{ position: "relative" }}>
          <label style={labelStyle}>Month</label>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={monthPickerOpen}
            onClick={() => setMonthPickerOpen((open) => !open)}
            style={{
              width: "100%",
              minHeight: 48,
              padding: "0 0.75rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.5rem",
              fontSize: "0.95rem",
              fontWeight: 700,
              fontFamily: "inherit",
              color: "#2B2B2B",
              background: "#FFFFFF",
              border: `1px solid ${monthPickerOpen ? COLORS.teal : COLORS.border}`,
              borderRadius: "0.6rem",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span>{monthOptions.find((o) => o.value === safeMonthValue)?.label ?? safeMonthValue}</span>
            <span
              className="material-symbols-outlined"
              style={{ color: COLORS.muted, fontSize: "1.25rem", transition: "transform 0.15s ease" }}
            >
              {monthPickerOpen ? "expand_less" : "expand_more"}
            </span>
          </button>

          {monthPickerOpen && (
            <>
              <div
                style={{ position: "fixed", inset: 0, zIndex: 130, background: "rgba(0,0,0,0.25)" }}
                onClick={() => setMonthPickerOpen(false)}
                aria-hidden="true"
              />
              <div
                role="dialog"
                aria-label="Choose month"
                style={{
                  position: "absolute",
                  top: "calc(100% + 0.35rem)",
                  left: 0,
                  right: 0,
                  zIndex: 131,
                  background: "#FFFFFF",
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "0.9rem",
                  boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
                  padding: "0.75rem",
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "0.45rem",
                  maxHeight: "60vh",
                  overflowY: "auto",
                }}
              >
                {monthOptions.map((o) => {
                  const selected = o.value === safeMonthValue;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => {
                        const [y, m] = o.value.split("-").map(Number);
                        setYear(y);
                        setMonth(m);
                        setMonthPickerOpen(false);
                      }}
                      style={{
                        minHeight: 40,
                        padding: "0 0.35rem",
                        borderRadius: "0.55rem",
                        border: selected ? "2px solid #1F6B4D" : `1px solid ${COLORS.border}`,
                        background: selected ? COLORS.teal : "#FFFFFF",
                        color: selected ? "#FFFFFF" : "#2B2B2B",
                        fontWeight: selected ? 800 : 600,
                        fontSize: "0.75rem",
                        fontFamily: "inherit",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.25rem",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {o.label.split(" ")[0]}
                      <span style={{ opacity: selected ? 0.85 : 0.55, fontSize: "0.68rem" }}>
                        {o.label.split(" ")[1]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <div>
          <label htmlFor="week-select" style={labelStyle}>Week</label>
          <select
            id="week-select"
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
            style={selectStyle}
          >
            {WEEK_LABELS.map((label, i) => (
              <option key={label} value={i + 1}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {banner && (
        <div
          role="status"
          style={{
            position: "fixed",
            top: "118px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 120,
            background: COLORS.teal,
            color: "#fff",
            padding: "0.75rem 1.25rem",
            borderRadius: "0.75rem",
            fontSize: "0.95rem",
            fontWeight: 800,
            boxShadow: "0 10px 30px rgba(31,107,77,0.4)",
            whiteSpace: "nowrap",
            maxWidth: "calc(100vw - 2rem)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "1.25rem" }}>check_circle</span>
          {banner}
        </div>
      )}

      {error && (
        <div style={{ background: "#FDF0F0", color: COLORS.danger, padding: "0.6rem 0.75rem", borderRadius: "0.5rem", fontSize: "0.8125rem", marginBottom: "0.6rem" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", padding: "2.5rem 0", color: COLORS.muted }}>
          <span className="material-symbols-outlined" style={{ fontSize: "1.75rem", opacity: 0.6 }}>hourglass_top</span>
          <span style={{ fontSize: "0.875rem" }}>Loading roster…</span>
        </div>
      ) : classInfo && roster.length > 0 ? (
        <>
          {isCollapsed ? (
            <button
              type="button"
              onClick={() =>
                setCollapsedWeeks((prev) => {
                  const next = new Set(prev);
                  next.delete(currentKey);
                  return next;
                })
              }
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
                padding: "1rem 1.1rem",
                background: "#FFFFFF",
                border: `1px solid ${unreviewedCount > 0 ? COLORS.amber : COLORS.teal}`,
                borderRadius: "0.9rem",
                boxShadow: unreviewedCount > 0
                  ? "0 2px 10px rgba(217,164,65,0.12)"
                  : "0 2px 10px rgba(31,107,77,0.08)",
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 0 }}>
                <span
                  className="material-symbols-outlined"
                  style={{ color: unreviewedCount > 0 ? COLORS.amber : COLORS.teal, fontSize: "1.4rem", flexShrink: 0 }}
                >
                  {unreviewedCount > 0 ? "edit_note" : "check_circle"}
                </span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "#2B2B2B" }}>
                    {unreviewedCount > 0
                      ? `Week ${week} — In progress`
                      : `Week ${week} — Submitted`}
                  </p>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: COLORS.muted }}>
                    {unreviewedCount > 0
                      ? `${roster.length - unreviewedCount} of ${roster.length} reviewed · ${unreviewedCount} still need a selection`
                      : submittedAt
                        ? `${formatSubmittedAt(submittedAt)}${submittedByName ? ` · Submitted by ${submittedByName}` : ""} · ${presentCount} present · ${absentCount} absent`
                        : `${presentCount} present · ${absentCount} absent`}
                  </p>
                </div>
              </div>
              <span
                className="material-symbols-outlined"
                style={{ color: COLORS.muted, fontSize: "1.25rem", flexShrink: 0 }}
              >
                expand_more
              </span>
            </button>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", padding: "0 0.1rem", gap: "0.75rem" }}>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: COLORS.teal }}>{classInfo.name}</h2>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: COLORS.muted, flexShrink: 0 }}>
                  {presentCount} P · {absentCount} A
                  {unreviewedCount > 0 ? ` · ${unreviewedCount} to review` : ""}
                </span>
              </div>

              {selectedClass?.isSubstituteCoverage && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    marginBottom: "0.75rem",
                    padding: "0.35rem 0.6rem",
                    borderRadius: "0.5rem",
                    background: "#FDF3E3",
                    color: "#8A5A00",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "0.95rem" }}>swap_horiz</span>
                  Substitute coverage — week {week} only · covering for {selectedClass.teacherName ?? "another teacher"}
                </div>
              )}

              <button
                type="button"
                onClick={() =>
                  setCollapsedWeeks((prev) => new Set(prev).add(currentKey))
                }
                aria-label="Collapse this week"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  minHeight: 44,
                  marginBottom: "0.75rem",
                  borderRadius: "0.75rem",
                  border: `1px solid ${COLORS.teal}`,
                  background: COLORS.teal,
                  color: "#FFFFFF",
                  fontWeight: 800,
                  fontSize: "0.9rem",
                  fontFamily: "inherit",
                  cursor: "pointer",
                  boxShadow: "0 2px 10px rgba(31,107,77,0.18)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>expand_less</span>
                Collapse — Week {week} complete
              </button>

              <div style={{ position: "relative", marginBottom: "0.75rem" }}>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter by name or ID…"
                  style={{
                    width: "100%",
                    minHeight: 44,
                    padding: "0 2.5rem 0 0.75rem",
                    fontSize: "0.9rem",
                    fontFamily: "inherit",
                    color: "#2B2B2B",
                    background: "#FFFFFF",
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: "0.6rem",
                    outline: "none",
                  }}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear filter"
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: COLORS.muted,
                      fontSize: "1.25rem",
                      lineHeight: 1,
                      padding: "0.25rem",
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {filteredRoster.map((row) => {
                  const present = row.present === true;
                  const absent = row.present === false;
                  const touched = row.present !== null;
                  return (
                    <div
                      key={row.participantId}
                      style={{
                        background: touched ? "#EFF7F3" : "#FFFFFF",
                        border: touched ? `2px solid ${COLORS.teal}` : `1px solid ${COLORS.border}`,
                        borderRadius: "0.75rem",
                        boxShadow: touched
                          ? "0 2px 8px rgba(31,107,77,0.16)"
                          : "0 1px 3px rgba(0,0,0,0.05)",
                        padding: touched ? "0.65rem 0.7rem" : "0.7rem 0.75rem",
                        transition: "background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease",
                      }}
                    >
                      <div style={{ marginBottom: "0.55rem", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: touched ? COLORS.teal : "#2B2B2B", lineHeight: 1.25, overflowWrap: "anywhere" }}>
                            {row.name}
                          </p>
                          <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: COLORS.muted, fontFamily: "var(--font-mono)" }}>
                            {row.localParticipantId}
                            {row.gradeLevel ? ` · ${row.gradeLevel}` : ""}
                          </p>
                        </div>
                        {touched ? (
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.25rem",
                              flexShrink: 0,
                              padding: "0.2rem 0.5rem",
                              borderRadius: "999px",
                              background: COLORS.teal,
                              color: "#FFFFFF",
                              fontSize: "0.7rem",
                              fontWeight: 800,
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "0.9rem" }}>check_circle</span>
                            Reviewed
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.25rem",
                              flexShrink: 0,
                              padding: "0.2rem 0.5rem",
                              borderRadius: "999px",
                              background: "#FDF0F0",
                              color: COLORS.danger,
                              fontSize: "0.7rem",
                              fontWeight: 800,
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "0.9rem" }}>priority_high</span>
                            Needs selection
                          </span>
                        )}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                        <button
                          type="button"
                          onClick={() => togglePresent(row.participantId, true)}
                          aria-pressed={present}
                          style={{
                            minHeight: 52,
                            borderRadius: "0.6rem",
                            border: present ? "2px solid #1F6B4D" : "1px solid #E8E3D9",
                            background: present ? "#1F6B4D" : "#FFFFFF",
                            color: present ? "#FFFFFF" : "#1F6B4D",
                            fontWeight: 800,
                            fontSize: "1rem",
                            fontFamily: "inherit",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "0.3rem",
                            transition: "background 0.12s ease, color 0.12s ease, border-color 0.12s ease",
                          }}
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePresent(row.participantId, false)}
                          aria-pressed={absent}
                          style={{
                            minHeight: 52,
                            borderRadius: "0.6rem",
                            border: absent ? "2px solid #D64545" : "1px solid #E8E3D9",
                            background: absent ? "#D64545" : "#FFFFFF",
                            color: absent ? "#FFFFFF" : "#D64545",
                            fontWeight: 800,
                            fontSize: "1rem",
                            fontFamily: "inherit",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "0.3rem",
                            transition: "background 0.12s ease, color 0.12s ease, border-color 0.12s ease",
                          }}
                        >
                          Absent
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {query.trim() && filteredRoster.length === 0 && (
                <div style={{ textAlign: "center", padding: "1.5rem 0", color: COLORS.muted }}>
                  <p style={{ margin: 0, fontSize: "0.875rem" }}>No participants match &ldquo;{query}&rdquo;.</p>
                </div>
              )}
            </>
          )}
        </>
      ) : classInfo && roster.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2.5rem 0", color: COLORS.muted }}>
          <span className="material-symbols-outlined" style={{ fontSize: "2rem", opacity: 0.5 }}>group_off</span>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem" }}>No participants assigned to this class yet.</p>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "2.5rem 0", color: COLORS.muted }}>
          <span className="material-symbols-outlined" style={{ fontSize: "2rem", opacity: 0.5 }}>menu_book</span>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem" }}>No classes assigned to you yet.</p>
        </div>
      )}

      {roster.length > 0 && !isCollapsed && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 110,
            padding: "0.6rem 0.75rem calc(0.6rem + env(safe-area-inset-bottom))",
            background: "rgba(250, 247, 240, 0.96)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            borderTop: "1px solid rgba(31,107,77,0.15)",
            boxShadow: "0 -4px 16px rgba(0,0,0,0.06)",
          }}
        >
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || unreviewedCount > 0}
            style={{
              width: "100%",
              maxWidth: 720,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
              minHeight: 54,
              borderRadius: "0.75rem",
              border: "none",
              background: submitting ? "#6b7b6f" : unreviewedCount > 0 ? "#C9C4B8" : COLORS.amber,
              color: "#0A261B",
              fontWeight: 800,
              fontSize: "1.05rem",
              fontFamily: "inherit",
              cursor: submitting || unreviewedCount > 0 ? "not-allowed" : "pointer",
              boxShadow: unreviewedCount > 0 ? "none" : "0 4px 16px rgba(217,164,65,0.4)",
              opacity: unreviewedCount > 0 ? 0.75 : 1,
            }}
          >
            {submitting
              ? "Saving…"
              : unreviewedCount > 0
                ? `${unreviewedCount} still need a selection`
                : justSubmitted
                  ? "Saved ✓"
                  : `Submit attendance (${roster.length})`}
          </button>
        </div>
      )}

      {coverageOpen && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 140, background: "rgba(0,0,0,0.4)" }}
            onClick={() => setCoverageOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Arrange coverage"
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 141,
              width: "min(480px, calc(100vw - 1.5rem))",
              maxHeight: "85vh",
              overflowY: "auto",
              background: "#FFFFFF",
              borderRadius: "1rem",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              padding: "1.25rem",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: COLORS.teal }}>
              Arrange coverage
            </h2>
            <p style={{ margin: "0.25rem 0 1rem", fontSize: "0.8125rem", color: COLORS.muted }}>
              Hand one of your classes to another teacher for specific week(s). They get temporary
              access to tick attendance, then it reverts automatically.
            </p>

            <label htmlFor="coverage-class" style={labelStyle}>Class</label>
            <select
              id="coverage-class"
              value={formClassId}
              onChange={(e) => setFormClassId(e.target.value)}
              style={selectStyle}
            >
              {initialClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <label htmlFor="coverage-substitute" style={{ ...labelStyle, marginTop: "0.75rem" }}>
              Substitute teacher
            </label>
            <select
              id="coverage-substitute"
              value={formSubstituteId}
              onChange={(e) => setFormSubstituteId(e.target.value)}
              style={selectStyle}
            >
              <option value="">Select a teacher…</option>
              {initialTeachers
                .filter((t) => t.id !== initialUserId)
                .map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
            </select>

            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: "0.6rem", marginTop: "0.75rem" }}>
              <div>
                <label htmlFor="coverage-month" style={labelStyle}>Month</label>
                <select
                  id="coverage-month"
                  value={formMonthValue}
                  onChange={(e) => setFormMonthValue(e.target.value)}
                  style={selectStyle}
                >
                  {monthOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="coverage-week-start" style={labelStyle}>From week</label>
                <select
                  id="coverage-week-start"
                  value={formWeekStart}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setFormWeekStart(v);
                    if (v > formWeekEnd) setFormWeekEnd(v);
                  }}
                  style={selectStyle}
                >
                  {WEEK_LABELS.map((label, i) => (
                    <option key={label} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="coverage-week-end" style={labelStyle}>To week</label>
                <select
                  id="coverage-week-end"
                  value={formWeekEnd}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setFormWeekEnd(v);
                    if (v < formWeekStart) setFormWeekStart(v);
                  }}
                  style={selectStyle}
                >
                  {WEEK_LABELS.map((label, i) => (
                    <option key={label} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </div>
            </div>

            {arrangeError && (
              <div style={{ background: "#FDF0F0", color: COLORS.danger, padding: "0.6rem 0.75rem", borderRadius: "0.5rem", fontSize: "0.8125rem", marginTop: "0.75rem" }}>
                {arrangeError}
              </div>
            )}

            <div style={{ display: "flex", gap: "0.6rem", marginTop: "1rem" }}>
              <button
                type="button"
                onClick={handleArrange}
                disabled={arrangeSaving || !formClassId || !formSubstituteId}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: "0.75rem",
                  border: "none",
                  background: arrangeSaving || !formClassId || !formSubstituteId ? "#C9C4B8" : COLORS.teal,
                  color: "#FFFFFF",
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  fontFamily: "inherit",
                  cursor: arrangeSaving || !formClassId || !formSubstituteId ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.4rem",
                  boxShadow: arrangeSaving || !formClassId || !formSubstituteId ? "none" : "0 4px 14px rgba(31,107,77,0.3)",
                }}
              >
                {arrangeSaving && (
                  <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>hourglass_top</span>
                )}
                {arrangeSaving ? "Arranging…" : "Arrange coverage"}
              </button>
              <button
                type="button"
                onClick={() => setCoverageOpen(false)}
                disabled={arrangeSaving}
                style={{
                  minHeight: 48,
                  padding: "0 1.1rem",
                  borderRadius: "0.75rem",
                  border: `1px solid ${COLORS.border}`,
                  background: "#FFFFFF",
                  color: COLORS.muted,
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  fontFamily: "inherit",
                  cursor: arrangeSaving ? "not-allowed" : "pointer",
                }}
              >
                Close
              </button>
            </div>

            <div style={{ marginTop: "1.25rem", borderTop: `1px solid ${COLORS.border}`, paddingTop: "1rem" }}>
              <h3 style={{ margin: "0 0 0.6rem", fontSize: "0.75rem", fontWeight: 800, color: COLORS.teal, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Your arrangements
              </h3>
              {arrangements.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.8125rem", color: COLORS.muted }}>
                  No coverage arrangements yet.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {arrangements.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "0.6rem",
                        padding: "0.65rem 0.75rem",
                        background: "#FAF7F0",
                        borderRadius: "0.6rem",
                        border: `1px solid ${COLORS.border}`,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 800, color: "#2B2B2B" }}>
                          {a.class.name}
                        </p>
                        <p style={{ margin: "0.1rem 0 0", fontSize: "0.75rem", color: COLORS.muted }}>
                          Substitute: {a.substitute.name}
                        </p>
                        <p style={{ margin: "0.1rem 0 0", fontSize: "0.75rem", color: COLORS.muted }}>
                          {formatCoverageWeeks(a.weeks)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCancelCoverage(a.id)}
                        disabled={cancellingId !== null}
                        style={{
                          flexShrink: 0,
                          minHeight: 34,
                          padding: "0 0.7rem",
                          borderRadius: "0.55rem",
                          border: `1px solid ${COLORS.danger}`,
                          background: "#FFFFFF",
                          color: COLORS.danger,
                          fontWeight: 700,
                          fontSize: "0.78rem",
                          fontFamily: "inherit",
                          cursor: cancellingId !== null ? "not-allowed" : "pointer",
                        }}
                      >
                        {cancellingId === a.id ? "Cancelling…" : "Cancel"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 700,
  color: COLORS.teal,
  marginBottom: "0.3rem",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 48,
  padding: "0 2.25rem 0 0.75rem",
  fontSize: "0.95rem",
  fontWeight: 700,
  fontFamily: "inherit",
  color: "#2B2B2B",
  background: "#FFFFFF",
  border: `1px solid ${COLORS.border}`,
  borderRadius: "0.6rem",
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 0.75rem center",
};
