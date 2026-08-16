"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SUNDAY_SCHOOL_FIRST_EXPORT_MONTH,
  getSundaySchoolExportMonthOptions,
} from "@/modules/sunday-school/export-months";

interface ClassOption {
  id: string;
  name: string;
  teacherId: string;
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

export default function MyClassClient({
  initialClasses,
  initialYear,
  initialMonth,
  initialWeek,
}: {
  initialClasses: ClassOption[];
  initialYear: number;
  initialMonth: number;
  initialWeek: number;
}) {
  const [classId, setClassId] = useState<string>(initialClasses[0]?.id ?? "");
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [week, setWeek] = useState(initialWeek);
  const [query, setQuery] = useState("");
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<string>>(new Set());
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [classInfo, setClassInfo] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const monthOptions = useMemo(() => getSundaySchoolExportMonthOptions(), []);

  const safeMonthValue = monthOptions.some((o) => o.value === `${year}-${month}`)
    ? `${year}-${month}`
    : SUNDAY_SCHOOL_FIRST_EXPORT_MONTH;

  const currentKey = `${classId}-${year}-${month}-${week}`;
  const isCollapsed = collapsedWeeks.has(currentKey);

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

  useEffect(() => {
    loadRoster(classId, year, month, week);
  }, [classId, year, month, week, loadRoster]);

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

      {initialClasses.length > 1 && (
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
            {initialClasses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
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
                        ? `${formatSubmittedAt(submittedAt)} · ${presentCount} present · ${absentCount} absent`
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
