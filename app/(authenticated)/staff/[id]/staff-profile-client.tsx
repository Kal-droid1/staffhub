"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StatusPill from "@/modules/core/components/status-pill";
import RadialGauge from "@/modules/core/components/radial-gauge";
import { formatDays, formatAttendanceStatus } from "@/lib/format";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  jobTitleId: string | null;
  jobTitle: { id: string; name: string } | null;
  isActive: boolean;
  hideFromReports: boolean;
  deactivatedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

interface Balance {
  leaveTypeId: string;
  leaveTypeName: string;
  isAnnualRecurring: boolean;
  granted: number;
  used: number;
  remaining: number;
}

interface RecordRow {
  id: string;
  date: string;
  signInTime: string | null;
  requestedStatus: string;
  status: string;
  note: string | null;
  leaveTypeId: string | null;
  leaveTypeName: string | null;
  attachmentUrl: string | null;
  batchId: string | null;
  reviewedBy: { id: string; name: string } | null;
}

interface GrantRow {
  id: string;
  leaveTypeName: string;
  days: number;
  grantedDate: string;
  note: string | null;
  expiresAt: string | null;
}

interface DocumentFile {
  id: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
  uploadedByName: string;
}

interface DocumentCategory {
  category: string;
  files: DocumentFile[];
}

interface JobTitleOption {
  id: string;
  name: string;
}

interface Props {
  staff: StaffMember;
  balances: Balance[];
  records: RecordRow[];
  grants: GrantRow[];
  documents: DocumentCategory[];
}

const ROLE_OPTIONS = ["STAFF", "MANAGER"];
const PAGE_SIZE = 12;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function StaffProfileClient({ staff, balances, records, grants, documents: initialDocuments }: Props) {
  const router = useRouter();

  const [jobTitles, setJobTitles] = useState<JobTitleOption[]>([]);

  const [showEdit, setShowEdit] = useState(false);
  const [editingName, setEditingName] = useState(staff.name);
  const [editingEmail, setEditingEmail] = useState(staff.email);
  const [editingRole, setEditingRole] = useState(staff.role);
  const [editingJobTitleId, setEditingJobTitleId] = useState(staff.jobTitleId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [actingId, setActingId] = useState<string | null>(null);
  const [hideFromReports, setHideFromReports] = useState(staff.hideFromReports);
  const [showConfirmation, setShowConfirmation] = useState<"deactivate" | "delete" | null>(null);

  const now = new Date();
  const [summaryMonth, setSummaryMonth] = useState(now.getMonth() + 1);
  const [summaryYear, setSummaryYear] = useState(now.getFullYear());

  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [page, setPage] = useState(0);

  const [documents, setDocuments] = useState<DocumentCategory[]>(initialDocuments);
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [docError, setDocError] = useState("");
  const [docSuccess, setDocSuccess] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ docId: string; category: string; isLatest: boolean; hasPrevious: boolean } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  useEffect(() => {
    fetch("/api/job-titles")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setJobTitles(data);
      })
      .catch(() => {});
  }, []);

  interface GroupedRecord {
    firstId: string;
    batchId: string | null;
    dateRange: string;
    requestedStatus: string;
    status: string;
    note: string | null;
    leaveTypeId: string | null;
    leaveTypeName: string | null;
    attachmentUrl: string | null;
    reviewedBy: { id: string; name: string } | null;
    count: number;
  }

  const groupedRecords = useMemo((): GroupedRecord[] => {
    const groups = new Map<string | null, RecordRow[]>();
    for (const r of records) {
      const key = r.batchId || r.id;
      const existing = groups.get(key);
      if (existing) {
        existing.push(r);
      } else {
        groups.set(key, [r]);
      }
    }

    const result: GroupedRecord[] = [];
    for (const recs of groups.values()) {
      recs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const first = recs[0];
      const last = recs[recs.length - 1];
      const dateRange = recs.length > 1
        ? `${new Date(first.date).toLocaleDateString()} \u2013 ${new Date(last.date).toLocaleDateString()}`
        : new Date(first.date).toLocaleDateString();

      result.push({
        firstId: first.id,
        batchId: first.batchId,
        dateRange,
        requestedStatus: first.requestedStatus,
        status: first.status,
        note: first.note,
        leaveTypeId: first.leaveTypeId,
        leaveTypeName: first.leaveTypeName,
        attachmentUrl: first.attachmentUrl,
        reviewedBy: first.reviewedBy,
        count: recs.length,
      });
    }
    return result;
  }, [records]);

  const monthSummary = useMemo(() => {
    const start = new Date(summaryYear, summaryMonth - 1, 1);
    const end = new Date(summaryYear, summaryMonth, 1);
    let present = 0, absent = 0, leave = 0, pending = 0;
    for (const r of records) {
      const d = new Date(r.date);
      if (d < start || d >= end) continue;
      switch (r.status) {
        case "PRESENT": case "FIELD_WORK": present++; break;
        case "ABSENT": absent++; break;
        case "PERMISSION": case "ANNUAL_LEAVE": case "OTHER": leave++; break;
        case "PENDING": pending++; break;
      }
    }
    return { present, absent, leave, pending };
  }, [records, summaryMonth, summaryYear]);

  const filteredRecords = useMemo(() => {
    let result = groupedRecords;

    if (filterType !== "all") {
      result = result.filter((r) => r.requestedStatus === filterType);
    }

    if (filterStatus !== "all") {
      result = result.filter((r) => getApprovalStatus(r.status, r.reviewedBy) === filterStatus);
    }

    if (filterFromDate) {
      const from = new Date(filterFromDate);
      result = result.filter((r) => {
        const d = new Date(r.dateRange.split(" \u2013 ")[0]);
        return d >= from;
      });
    }

    if (filterToDate) {
      const to = new Date(filterToDate);
      to.setHours(23, 59, 59, 999);
      result = result.filter((r) => {
        const rangeEnd = r.dateRange.split(" \u2013 ");
        const d = new Date(rangeEnd[rangeEnd.length - 1]);
        return d <= to;
      });
    }

    return result;
  }, [groupedRecords, filterType, filterStatus, filterFromDate, filterToDate]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);
  const pagedRecords = filteredRecords.slice(clampedPage * PAGE_SIZE, (clampedPage + 1) * PAGE_SIZE);

  if (clampedPage !== page) {
    setTimeout(() => setPage(clampedPage), 0);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingName.trim() || !editingEmail.trim()) return;
    setSaving(true);
    setError("");

    const res = await fetch("/api/staff", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: staff.id,
        name: editingName.trim(),
        email: editingEmail.trim(),
        role: editingRole,
        jobTitleId: editingJobTitleId || null,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to update.");
      setSaving(false);
      return;
    }

    setShowEdit(false);
    setSaving(false);
    router.refresh();
  }

  async function handleDeactivate() {
    setActingId(staff.id);
    const res = await fetch("/api/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: staff.id, action: "deactivate", hideFromReports }),
    });
    if (res.ok) router.refresh();
    setActingId(null);
    setShowConfirmation(null);
  }

  async function handleReactivate() {
    setActingId(staff.id);
    const res = await fetch("/api/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: staff.id, action: "reactivate" }),
    });
    if (res.ok) router.refresh();
    setActingId(null);
  }

  async function handleDelete() {
    setActingId(staff.id);
    const res = await fetch("/api/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: staff.id, action: "delete" }),
    });
    if (res.ok) router.push("/staff");
    setActingId(null);
    setShowConfirmation(null);
  }

  async function handleDocumentUpload(category: string, file: File) {
    setUploadingCategory(category);
    setDocError("");
    setDocSuccess("");
    const formData = new FormData();
    formData.append("userId", staff.id);
    formData.append("category", category);
    formData.append("file", file);

    const res = await fetch("/api/staff-documents", { method: "POST", body: formData });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setDocError(data.error || "Upload failed");
      setUploadingCategory(null);
      return;
    }

    const newDoc = await res.json();
    setDocuments((prev) =>
      prev.map((c) =>
        c.category === category
          ? { ...c, files: [newDoc, ...c.files] }
          : c
      )
    );
    setDocSuccess(`"${category}" uploaded successfully.`);
    setUploadingCategory(null);
    setTimeout(() => setDocSuccess(""), 3000);
  }

  async function handleDocumentDelete(docId: string, category: string, action?: "leave-empty" | "promote" | "upload-new") {
    setDeletingId(docId);

    if (!action) {
      const res = await fetch(`/api/staff-documents?id=${encodeURIComponent(docId)}`, { method: "DELETE" });
      if (!res.ok) {
        setDocError("Delete failed");
        setDeletingId(null);
        return;
      }
      setDocuments((prev) =>
        prev.map((c) =>
          c.category === category
            ? { ...c, files: c.files.filter((f) => f.id !== docId) }
            : c
        )
      );
      setDocSuccess("Version deleted.");
      setTimeout(() => setDocSuccess(""), 3000);
      setDeletingId(null);
      setDeleteTarget(null);
      return;
    }

    if (action === "leave-empty") {
      const res = await fetch(`/api/staff-documents?id=${encodeURIComponent(docId)}`, { method: "DELETE" });
      if (!res.ok) {
        setDocError("Delete failed");
        setDeletingId(null);
        return;
      }
      setDocuments((prev) =>
        prev.map((c) =>
          c.category === category
            ? { ...c, files: c.files.filter((f) => f.id !== docId) }
            : c
        )
      );
      setDocSuccess("Document removed. Category is now empty.");
      setTimeout(() => setDocSuccess(""), 3000);
      setDeletingId(null);
      setDeleteTarget(null);
      return;
    }

    if (action === "promote") {
      const cat = documents.find((c) => c.category === category);
      const next = cat?.files.find((f) => f.id !== docId);
      if (!next) {
        setDeletingId(null);
        setDeleteTarget(null);
        return;
      }
      const res = await fetch(`/api/staff-documents?id=${encodeURIComponent(docId)}`, { method: "DELETE" });
      if (!res.ok) {
        setDocError("Delete failed");
        setDeletingId(null);
        return;
      }
      setDocuments((prev) =>
        prev.map((c) =>
          c.category === category
            ? { ...c, files: c.files.filter((f) => f.id !== docId) }
            : c
        )
      );
      setDocSuccess("Previous version promoted.");
      setTimeout(() => setDocSuccess(""), 3000);
      setDeletingId(null);
      setDeleteTarget(null);
      return;
    }

    if (action === "upload-new") {
      const res = await fetch(`/api/staff-documents?id=${encodeURIComponent(docId)}`, { method: "DELETE" });
      if (!res.ok) {
        setDocError("Delete failed");
        setDeletingId(null);
        return;
      }
      setDocuments((prev) =>
        prev.map((c) =>
          c.category === category
            ? { ...c, files: c.files.filter((f) => f.id !== docId) }
            : c
        )
      );
      setUploadingCategory(category);
      setDeletingId(null);
      setDeleteTarget(null);
      const input = document.querySelector(`input[data-category="${CSS.escape(category)}"]`) as HTMLInputElement | null;
      if (input) input.click();
    }
  }

  function getApprovalStatus(status: string, reviewedBy: { id: string; name: string } | null): string {
    if (status === "PENDING") return "Pending";
    if (status === "PRESENT" || status === "FIELD_WORK") return "Present";
    if (status === "ABSENT") return reviewedBy ? "Rejected" : "Absent";
    if (status === "PERMISSION" || status === "ANNUAL_LEAVE" || status === "OTHER") {
      return reviewedBy ? "Approved" : "Pending";
    }
    return "Unknown";
  }

  function getStatusLabel(status: string, reviewedBy: { id: string; name: string } | null): string {
    return getApprovalStatus(status, reviewedBy);
  }

  function getStatusVariant(status: string, reviewedBy: { id: string; name: string } | null): "approved" | "rejected" | "pending" {
    const approval = getApprovalStatus(status, reviewedBy);
    if (approval === "Pending") return "pending";
    if (approval === "Approved" || approval === "Present") return "approved";
    if (approval === "Rejected" || approval === "Absent") return "rejected";
    return "pending";
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <header style={{ marginBottom: "1.5rem" }}>
        <Link
          href="/staff"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            color: "#1F6B4D",
            fontSize: "0.85rem",
            fontWeight: 500,
            textDecoration: "none",
            marginBottom: "1rem",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#D9A441")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#1F6B4D")}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>arrow_back</span>
          Back to Staff
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <h1 style={{
            fontSize: "2.5rem",
            fontWeight: 800,
            color: "#1F6B4D",
            margin: 0,
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
          }}>
            {staff.name}
          </h1>
          <span style={{
            display: "inline-block",
            padding: "0.2rem 0.75rem",
            borderRadius: "999px",
            fontSize: "0.75rem",
            fontWeight: 600,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.03em",
            backgroundColor: staff.role === "MANAGER" ? "#D9A441" : "var(--color-muted)",
            color: staff.role === "MANAGER" ? "#fff" : "var(--color-text)",
            border: staff.role === "MANAGER" ? "none" : "1px solid rgba(191,201,193,0.3)",
            boxShadow: staff.role === "MANAGER" ? "0 2px 8px rgba(217,164,65,0.4)" : "none",
          }}>
            {staff.role}
          </span>
          {!staff.isActive && (
            <span style={{
              display: "inline-block",
              padding: "0.2rem 0.75rem",
              borderRadius: "999px",
              fontSize: "0.75rem",
              fontWeight: 600,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.03em",
              backgroundColor: "#ba1a1a",
              color: "#fff",
            }}>
              Inactive
            </span>
          )}
        </div>
      </header>

      {/* Top section: Details + Attendance Snapshot */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 2fr",
        gap: "1.5rem",
        marginBottom: "1.5rem",
      }}>
        {/* Details Card */}
        <section style={{
          background: "rgba(250, 247, 240, 0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.4)",
          borderTop: "4px solid #D9A441",
          borderRadius: "0.75rem",
          boxShadow: "0 8px 32px rgba(31, 107, 77, 0.08), 0 2px 8px rgba(0,0,0,0.04)",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}>
          <h2 style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#1F6B4D",
            fontFamily: "var(--font-mono)",
            margin: 0,
          }}>
            DETAILS
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "0.5rem", borderBottom: "1px solid rgba(191,201,193,0.3)" }}>
              <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>Email</span>
              <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{staff.email}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "0.5rem", borderBottom: "1px solid rgba(191,201,193,0.3)" }}>
              <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>Job Title</span>
              <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{staff.jobTitle?.name || "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "0.5rem", borderBottom: "1px solid rgba(191,201,193,0.3)" }}>
              <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>Status</span>
              <StatusPill
                status={staff.isActive ? "present" : "absent"}
                label={staff.isActive ? "Active" : "Inactive"}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "0.5rem", borderBottom: "1px solid rgba(191,201,193,0.3)" }}>
              <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>Joined</span>
              <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{new Date(staff.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", paddingTop: "1rem", borderTop: "1px solid rgba(191,201,193,0.3)" }}>
            {!showEdit && (
              <button
                onClick={() => setShowEdit(true)}
                style={{
                  flex: 1,
                  padding: "0.5rem 1rem",
                  background: "#1F6B4D",
                  color: "#fff",
                  border: "none",
                  borderRadius: "0.25rem",
                  fontWeight: 500,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                }}
              >
                Edit
              </button>
            )}
            {staff.isActive ? (
              <>
                <button
                  onClick={() => setShowConfirmation("deactivate")}
                  disabled={actingId === staff.id}
                  style={{
                    flex: 1,
                    padding: "0.5rem 1rem",
                    background: "none",
                    border: "1px solid #1F6B4D",
                    borderRadius: "0.25rem",
                    color: "#1F6B4D",
                    fontWeight: 500,
                    fontSize: "0.8125rem",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Deactivate
                </button>
                <button
                  onClick={() => setShowConfirmation("delete")}
                  disabled={actingId === staff.id}
                  style={{
                    flex: 1,
                    padding: "0.5rem 1rem",
                    background: "none",
                    border: "1px solid #ba1a1a",
                    borderRadius: "0.25rem",
                    color: "#ba1a1a",
                    fontWeight: 500,
                    fontSize: "0.8125rem",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Delete
                </button>
              </>
            ) : (
              <button
                onClick={handleReactivate}
                disabled={actingId === staff.id}
                style={{
                  flex: 1,
                  padding: "0.5rem 1rem",
                  background: "#1F6B4D",
                  color: "#fff",
                  border: "none",
                  borderRadius: "0.25rem",
                  fontWeight: 500,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Reactivate
              </button>
            )}
          </div>
        </section>

        {/* Attendance Snapshot */}
        <section style={{
          background: "linear-gradient(135deg, #1F6B4D 0%, #0A261B 100%)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 12px 40px rgba(31, 107, 77, 0.2)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}>
          <div style={{ position: "absolute", inset: 0, opacity: 0.1, backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "20px 20px", pointerEvents: "none" }} />
          <div style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "16rem",
            height: "16rem",
            background: "rgba(255,255,255,0.03)",
            borderRadius: "50%",
            filter: "blur(48px)",
            transform: "translate(5rem, -5rem)",
            pointerEvents: "none",
          }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <h2 style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#D9A441",
                fontFamily: "var(--font-mono)",
                margin: 0,
              }}>
                ATTENDANCE SNAPSHOT
              </h2>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <select
                  value={summaryMonth}
                  onChange={(e) => { setSummaryMonth(Number(e.target.value)); setPage(0); }}
                  style={{
                    appearance: "none",
                    background: "rgba(255,255,255,0.1)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: "0.25rem",
                    padding: "0.35rem 2rem 0.35rem 0.75rem",
                    fontSize: "0.8125rem",
                    fontFamily: "inherit",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  {monthOptions.map((m) => (<option key={m} value={m} style={{color:"#000"}}>{MONTH_NAMES[m - 1]}</option>))}
                </select>
                <select
                  value={summaryYear}
                  onChange={(e) => { setSummaryYear(Number(e.target.value)); setPage(0); }}
                  style={{
                    appearance: "none",
                    background: "rgba(255,255,255,0.1)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: "0.25rem",
                    padding: "0.35rem 2rem 0.35rem 0.75rem",
                    fontSize: "0.8125rem",
                    fontFamily: "inherit",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  {yearOptions.map((y) => (<option key={y} value={y} style={{color:"#000"}}>{y}</option>))}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
              <div style={{
                background: "rgba(255,255,255,0.05)",
                borderRadius: "0.75rem",
                border: "1px solid rgba(255,255,255,0.1)",
                padding: "1rem",
                textAlign: "center",
              }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", marginBottom: "0.5rem", fontFamily: "var(--font-mono)" }}>Present</div>
                <div style={{ fontSize: "2.5rem", fontWeight: 800, textShadow: "0 0 20px rgba(217,164,65,0.4)" }}>{monthSummary.present}</div>
              </div>
              <div style={{
                background: "rgba(255,255,255,0.05)",
                borderRadius: "0.75rem",
                border: "1px solid rgba(255,255,255,0.1)",
                padding: "1rem",
                textAlign: "center",
              }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", marginBottom: "0.5rem", fontFamily: "var(--font-mono)" }}>Absent</div>
                <div style={{ fontSize: "2.5rem", fontWeight: 800 }}>{monthSummary.absent}</div>
              </div>
              <div style={{
                background: "rgba(255,255,255,0.05)",
                borderRadius: "0.75rem",
                border: "1px solid rgba(255,255,255,0.1)",
                borderTop: "2px solid #D9A441",
                padding: "1rem",
                textAlign: "center",
              }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", marginBottom: "0.5rem", fontFamily: "var(--font-mono)" }}>Leave</div>
                <div style={{ fontSize: "2.5rem", fontWeight: 800, textShadow: "0 0 20px rgba(217,164,65,0.4)" }}>{monthSummary.leave}</div>
              </div>
              <div style={{
                background: "rgba(255,255,255,0.05)",
                borderRadius: "0.75rem",
                border: "1px solid rgba(217,164,65,0.3)",
                boxShadow: "0 0 15px rgba(217,164,65,0.1)",
                borderTop: "2px solid #D9A441",
                padding: "1rem",
                textAlign: "center",
              }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", marginBottom: "0.5rem", fontFamily: "var(--font-mono)" }}>Pending</div>
                <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#D9A441", textShadow: "0 0 20px rgba(217,164,65,0.6)" }}>{monthSummary.pending}</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Middle section: Leave Balances + Documents */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 2fr",
        gap: "1.5rem",
        marginBottom: "1.5rem",
      }}>
        {/* Leave Balances */}
        <section style={{
          background: "rgba(250, 247, 240, 0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.4)",
          borderRadius: "0.75rem",
          boxShadow: "0 8px 32px rgba(31, 107, 77, 0.08), 0 2px 8px rgba(0,0,0,0.04)",
          padding: "1.5rem",
        }}>
          <h2 style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#1F6B4D",
            fontFamily: "var(--font-mono)",
            margin: "0 0 1.5rem",
          }}>
            LEAVE BALANCES
          </h2>
          {balances.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "2rem 0" }}>No leave types configured.</p>
          ) : (
            balances.map((b) => {
              const maxVal = Math.max(b.granted, b.remaining + b.used);
              return (
                <div key={b.leaveTypeId} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <RadialGauge value={b.remaining} max={maxVal} size={180} strokeWidth={10} />
                  <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#1F6B4D", position: "relative", marginTop: "-7rem", marginBottom: "2rem" }}>
                    {formatDays(b.remaining)}
                  </div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginTop: "2.5rem", marginBottom: "0.25rem" }}>
                    Days Left
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "#1F6B4D", marginBottom: "0.25rem" }}>
                    {b.leaveTypeName}
                    {b.isAnnualRecurring && <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginLeft: "0.35rem" }}>(annual)</span>}
                  </div>
                  <div style={{ display: "flex", width: "100%", justifyContent: "space-around", padding: "0.75rem 0", background: "rgba(255,255,255,0.5)", borderRadius: "0.5rem", border: "1px solid rgba(191,201,193,0.2)", marginTop: "0.25rem" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginBottom: "0.25rem" }}>GRANTED</div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1F6B4D" }}>{formatDays(b.granted)}</div>
                    </div>
                    <div style={{ width: 1, background: "rgba(191,201,193,0.3)" }} />
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginBottom: "0.25rem" }}>USED</div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1F6B4D" }}>{formatDays(b.used)}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* Documents — keep entirely untouched */}
        <section>
          <h2 style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#1F6B4D", fontFamily: "var(--font-mono)", margin: "0 0 0.75rem" }}>
            Documents
          </h2>

          {docError && <p className="form-error mb-2">{docError}</p>}
          {docSuccess && <p className="form-success mb-2">{docSuccess}</p>}

          <div style={{
            background: "rgba(250, 247, 240, 0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.4)",
            borderRadius: "0.75rem",
            boxShadow: "0 8px 32px rgba(31, 107, 77, 0.08), 0 2px 8px rgba(0,0,0,0.04)",
            marginBottom: "1.25rem",
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {documents.map((cat) => {
                const latest = cat.files[0] ?? null;
                const hasHistory = cat.files.length > 1;
                const isExpanded = expandedCategory === cat.category;
                return (
                  <div key={cat.category} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.65rem 0", borderBottom: "1px solid var(--color-border-light)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "var(--color-text)" }}>{cat.category}</p>
                      {latest ? (
                        <div style={{ marginTop: "0.2rem" }}>
                          <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>{latest.fileName}</span>
                          <span style={{ fontSize: "0.7rem", color: "var(--color-text-light)", marginLeft: "0.5rem" }}>
                            {new Date(latest.uploadedAt).toLocaleDateString()} by {latest.uploadedByName}
                          </span>
                        </div>
                      ) : (
                        <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "var(--color-text-light)", fontStyle: "italic" }}>
                          Not uploaded yet
                        </p>
                      )}
                      {hasHistory && (
                        <button
                          onClick={() => setExpandedCategory(isExpanded ? null : cat.category)}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", color: "var(--color-brand)", fontWeight: 600, padding: 0, marginTop: "0.15rem" }}
                        >
                          {isExpanded ? "Hide" : `View ${cat.files.length - 1} previous versions`}
                        </button>
                      )}
                      {isExpanded && hasHistory && (
                        <div style={{ marginTop: "0.4rem", paddingLeft: "0.5rem", borderLeft: "2px solid var(--color-border)" }}>
                          {cat.files.slice(1).map((f) => (
                            <div key={f.id} style={{ fontSize: "0.78rem", padding: "0.25rem 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                              <div style={{ minWidth: 0 }}>
                                <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{f.fileName}</span>
                                <span style={{ color: "var(--color-text-light)", marginLeft: "0.4rem" }}>
                                  {new Date(f.uploadedAt).toLocaleDateString()} by {f.uploadedByName}
                                </span>
                              </div>
                              <div style={{ display: "flex", gap: "0.35rem", flexShrink: 0 }}>
                                <a
                                  href={`/api/attachments?url=${encodeURIComponent(f.fileUrl)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-ghost btn-sm"
                                  style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}
                                >
                                  View
                                </a>
                                <a
                                  href={`/api/attachments?url=${encodeURIComponent(f.fileUrl)}&download=1`}
                                  className="btn btn-ghost btn-sm"
                                  style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}
                                >
                                  Download
                                </a>
                                <button
                                  onClick={() => setDeleteTarget({ docId: f.id, category: cat.category, isLatest: false, hasPrevious: false })}
                                  disabled={deletingId === f.id}
                                  className="btn btn-ghost btn-sm"
                                  style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem", color: "var(--color-danger)" }}
                                >
                                  {deletingId === f.id ? "…" : "Delete"}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "0.35rem", flexShrink: 0, marginLeft: "0.75rem" }}>
                      {latest && (
                        <>
                          <a
                            href={`/api/attachments?url=${encodeURIComponent(latest.fileUrl)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-ghost btn-sm"
                          >
                            View
                          </a>
                          <a
                            href={`/api/attachments?url=${encodeURIComponent(latest.fileUrl)}&download=1`}
                            className="btn btn-ghost btn-sm"
                          >
                            Download
                          </a>
                          <button
                            onClick={() => setDeleteTarget({ docId: latest.id, category: cat.category, isLatest: true, hasPrevious: cat.files.length > 1 })}
                            disabled={deletingId === latest.id}
                            className="btn btn-danger btn-sm"
                          >
                            {deletingId === latest.id ? "…" : "Delete"}
                          </button>
                        </>
                      )}
                      <label className="btn btn-primary btn-sm" style={{ cursor: "pointer", position: "relative" }}>
                        {uploadingCategory === cat.category ? "Uploading..." : latest ? "Replace" : "Upload"}
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                          disabled={uploadingCategory === cat.category}
                          data-category={cat.category}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleDocumentUpload(cat.category, f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {deleteTarget && (
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
                onClick={() => setDeleteTarget(null)}
              />
              <div
                style={{
                  position: "relative",
                  background: "#FAF7F0",
                  borderRadius: "12px",
                  border: "1px solid rgba(255, 255, 255, 0.4)",
                  boxShadow: "0 20px 40px rgba(31, 107, 77, 0.25)",
                  borderTop: "4px solid #D9A441",
                  maxWidth: 480,
                  width: "calc(100% - 2rem)",
                  margin: "0 1rem",
                  padding: "1.5rem",
                }}
              >
                {!deleteTarget.isLatest ? (
                  <>
                    <p style={{ fontWeight: 500, margin: "0 0 0.75rem" }}>
                      Delete this version? This can be undone by an administrator if needed.
                    </p>
                    <div className="flex-row gap-sm">
                      <button
                        onClick={() => handleDocumentDelete(deleteTarget.docId, deleteTarget.category)}
                        disabled={deletingId === deleteTarget.docId}
                        className="btn btn-danger btn-sm"
                      >
                        {deletingId === deleteTarget.docId ? "Deleting..." : "Delete"}
                      </button>
                      <button onClick={() => setDeleteTarget(null)} className="btn btn-ghost btn-sm">Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ fontWeight: 600, margin: "0 0 0.75rem", color: "var(--color-brand)" }}>
                      Delete the current version of this document?
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                      <button
                        onClick={() => handleDocumentDelete(deleteTarget.docId, deleteTarget.category, "leave-empty")}
                        disabled={deletingId === deleteTarget.docId}
                        className="btn btn-ghost btn-sm"
                        style={{ justifyContent: "flex-start", textAlign: "left" }}
                      >
                        {deletingId === deleteTarget.docId ? "..." : "Leave empty"} — category shows "Not uploaded yet"
                      </button>
                      {deleteTarget.hasPrevious && (
                        <button
                          onClick={() => handleDocumentDelete(deleteTarget.docId, deleteTarget.category, "promote")}
                          disabled={deletingId === deleteTarget.docId}
                          className="btn btn-ghost btn-sm"
                          style={{ justifyContent: "flex-start", textAlign: "left" }}
                        >
                          {deletingId === deleteTarget.docId ? "..." : "Promote previous version"} — older version becomes current
                        </button>
                      )}
                      <button
                        onClick={() => handleDocumentDelete(deleteTarget.docId, deleteTarget.category, "upload-new")}
                        disabled={deletingId === deleteTarget.docId}
                        className="btn btn-primary btn-sm"
                        style={{ justifyContent: "flex-start", textAlign: "left" }}
                      >
                        Upload a new one now
                      </button>
                    </div>
                    <div style={{ marginTop: "0.75rem" }}>
                      <button onClick={() => setDeleteTarget(null)} className="btn btn-ghost btn-sm">Cancel</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Request History */}
      <section style={{
        background: "rgba(250, 247, 240, 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.4)",
        borderRadius: "0.75rem",
        boxShadow: "0 8px 32px rgba(31, 107, 77, 0.08), 0 2px 8px rgba(0,0,0,0.04)",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "1rem 1.5rem",
          borderBottom: "1px solid rgba(31,107,77,0.2)",
          background: "#1F6B4D",
          color: "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}>
          <h2 style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#D9A441",
            fontFamily: "var(--font-mono)",
            margin: 0,
          }}>
            REQUEST HISTORY
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "flex-end" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "rgba(255,255,255,0.8)", fontFamily: "var(--font-mono)", marginRight: "0.25rem" }}>FILTER:</span>
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setPage(0); }}
              style={{
                appearance: "none",
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "0.25rem",
                padding: "0.35rem 0.5rem",
                fontSize: "0.8125rem",
                fontFamily: "inherit",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="all" style={{color:"#000"}}>All types</option>
              <option value="PRESENT" style={{color:"#000"}}>Present</option>
              <option value="ABSENT" style={{color:"#000"}}>Absent</option>
              <option value="PERMISSION" style={{color:"#000"}}>Permission</option>
              <option value="ANNUAL_LEAVE" style={{color:"#000"}}>Annual Leave</option>
              <option value="OTHER" style={{color:"#000"}}>Other</option>
              <option value="FIELD_WORK" style={{color:"#000"}}>Field Work</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
              style={{
                appearance: "none",
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "0.25rem",
                padding: "0.35rem 0.5rem",
                fontSize: "0.8125rem",
                fontFamily: "inherit",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="all" style={{color:"#000"}}>All statuses</option>
              <option value="Pending" style={{color:"#000"}}>Pending</option>
              <option value="Approved" style={{color:"#000"}}>Approved</option>
              <option value="Rejected" style={{color:"#000"}}>Rejected</option>
              <option value="Present" style={{color:"#000"}}>Present</option>
              <option value="Absent" style={{color:"#000"}}>Absent</option>
            </select>
            <input
              type="date"
              value={filterFromDate}
              onChange={(e) => { setFilterFromDate(e.target.value); setPage(0); }}
              style={{
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "0.25rem",
                padding: "0.35rem 0.5rem",
                fontSize: "0.8125rem",
                fontFamily: "inherit",
                outline: "none",
                colorScheme: "dark",
              }}
            />
            <input
              type="date"
              value={filterToDate}
              onChange={(e) => { setFilterToDate(e.target.value); setPage(0); }}
              style={{
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "0.25rem",
                padding: "0.35rem 0.5rem",
                fontSize: "0.8125rem",
                fontFamily: "inherit",
                outline: "none",
                colorScheme: "dark",
              }}
            />
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-muted)" }}>No records found.</div>
        ) : (
          <>
            <div className="table-responsive">
            <table style={{
              width: "100%",
              textAlign: "left",
              borderCollapse: "collapse",
              background: "rgba(255,255,255,0.4)",
            }}>
              <thead>
                <tr style={{ background: "rgba(250,247,240,0.8)", borderBottom: "1px solid rgba(191,201,193,0.3)" }}>
                  <th style={{ padding: "1.25rem 1.5rem", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#1F6B4D", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>Date</th>
                  <th style={{ padding: "1.25rem 1.5rem", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#1F6B4D", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>Type</th>
                  <th style={{ padding: "1.25rem 1.5rem", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#1F6B4D", fontFamily: "var(--font-mono)", textAlign: "center" }}>Status</th>
                  <th style={{ padding: "1.25rem 1.5rem", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#1F6B4D", fontFamily: "var(--font-mono)" }}>Note</th>
                  <th style={{ padding: "1.25rem 1.5rem", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#1F6B4D", fontFamily: "var(--font-mono)", textAlign: "right" }}>Attachment</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: "0.8125rem" }}>
                {pagedRecords.map((r) => {
                  const displayType = r.requestedStatus === "FIELD_WORK"
                    ? "Field Work"
                    : r.leaveTypeName ?? formatAttendanceStatus(r.requestedStatus);
                  const label = r.count > 1
                    ? `${displayType} (${r.count} days)`
                    : displayType;
                  return (
                  <tr
                    key={r.firstId}
                    style={{ borderBottom: "1px solid rgba(191,201,193,0.2)", transition: "background 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.6)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    <td data-label="Date" style={{ padding: "1rem 1.5rem", whiteSpace: "nowrap", fontWeight: 500 }}>{r.dateRange}</td>
                    <td data-label="Type" style={{ padding: "1rem 1.5rem" }}>{label}</td>
                    <td data-label="Status" style={{ padding: "1rem 1.5rem", textAlign: "center" }}>
                      <StatusPill status={getStatusVariant(r.status, r.reviewedBy)} label={getStatusLabel(r.status, r.reviewedBy)} />
                    </td>
                    <td data-label="Note" style={{ padding: "1rem 1.5rem", color: "var(--color-text-muted)", maxWidth: "15rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.note || "\u2014"}</td>
                    <td data-label="Attachment" style={{ padding: "1rem 1.5rem", textAlign: "right" }}>
                      {r.attachmentUrl ? (
                        <div className="flex-row gap-sm" style={{ justifyContent: "flex-end" }}>
                          <a
                            href={`/api/attachments?url=${encodeURIComponent(r.attachmentUrl)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-ghost btn-sm"
                          >
                            View
                          </a>
                          <a
                            href={`/api/attachments?url=${encodeURIComponent(r.attachmentUrl)}&download=1`}
                            className="btn btn-ghost btn-sm"
                          >
                            Download
                          </a>
                        </div>
                      ) : (
                        <span className="text-muted">{"\u2014"}</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            <div style={{
              padding: "0.75rem 1.5rem",
              borderTop: "1px solid rgba(191,201,193,0.3)",
              background: "rgba(250,247,240,0.8)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.8125rem",
            }}>
              <button
                onClick={() => setPage(Math.max(0, clampedPage - 1))}
                disabled={clampedPage === 0}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  background: "none",
                  border: "none",
                  cursor: clampedPage === 0 ? "default" : "pointer",
                  color: "#1F6B4D",
                  opacity: clampedPage === 0 ? 0.4 : 1,
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "1.125rem" }}>arrow_back</span> Prev
              </button>
              <span style={{ fontWeight: 500, color: "var(--color-text-muted)" }}>
                Page {clampedPage + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, clampedPage + 1))}
                disabled={clampedPage >= totalPages - 1}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  background: "none",
                  border: "none",
                  cursor: clampedPage >= totalPages - 1 ? "default" : "pointer",
                  color: "#1F6B4D",
                  opacity: clampedPage >= totalPages - 1 ? 0.4 : 1,
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Next <span className="material-symbols-outlined" style={{ fontSize: "1.125rem" }}>arrow_forward</span>
              </button>
            </div>
          </>
        )}
      </section>

      {/* Edit form as modal */}
      {showEdit && (
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
            onClick={() => { setShowEdit(false); setError(""); }}
          />
          <div
            style={{
              position: "relative",
              background: "#FAF7F0",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.4)",
              boxShadow: "0 20px 40px rgba(31, 107, 77, 0.25)",
              borderTop: "4px solid #D9A441",
              maxWidth: 500,
              width: "calc(100% - 2rem)",
              maxHeight: "90vh",
              overflowY: "auto",
              margin: "0 1rem",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, color: "#1F6B4D", fontSize: "1.1rem", fontWeight: 700 }}>Edit Staff</h3>
              <button
                onClick={() => { setShowEdit(false); setError(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.5rem", color: "#1F6B4D", lineHeight: 1, padding: "0.25rem" }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label className="form-label">Name</label>
                <input type="text" className="form-input" value={editingName} onChange={(e) => setEditingName(e.target.value)} required />
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label className="form-label">Email</label>
                <input type="email" className="form-input" value={editingEmail} onChange={(e) => setEditingEmail(e.target.value)} required />
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label className="form-label">Role</label>
                <select value={editingRole} onChange={(e) => setEditingRole(e.target.value)} className="form-select">
                  {ROLE_OPTIONS.map((r) => (<option key={r} value={r}>{r}</option>))}
                </select>
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label className="form-label">Job Title</label>
                <select value={editingJobTitleId} onChange={(e) => setEditingJobTitleId(e.target.value)} className="form-select">
                  <option value="">— None —</option>
                  {jobTitles.map((jt) => (
                    <option key={jt.id} value={jt.id}>{jt.name}</option>
                  ))}
                </select>
              </div>
              {error && <p className="form-error mb-1">{error}</p>}
              <div className="flex-row gap-sm">
                <button type="submit" disabled={saving} className="btn btn-success btn-sm">{saving ? "Saving..." : "Save"}</button>
                <button type="button" onClick={() => { setShowEdit(false); setError(""); }} className="btn btn-ghost btn-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showConfirmation === "deactivate" && (
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
            onClick={() => { setShowConfirmation(null); setHideFromReports(false); }}
          />
          <div
            style={{
              position: "relative",
              background: "#FAF7F0",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.4)",
              boxShadow: "0 20px 40px rgba(31, 107, 77, 0.25)",
              borderTop: "4px solid #D9A441",
              maxWidth: 440,
              width: "calc(100% - 2rem)",
              margin: "0 1rem",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 style={{ margin: 0, color: "#1F6B4D", fontSize: "1.05rem", fontWeight: 700 }}>Deactivate Staff</h3>
              <button
                onClick={() => { setShowConfirmation(null); setHideFromReports(false); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.5rem", color: "#1F6B4D", lineHeight: 1, padding: "0.25rem" }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p style={{ margin: "0 0 1rem", fontSize: "0.9rem", color: "var(--color-text)" }}>
              Deactivate <strong>{staff.name}</strong>? They will no longer be able to log in until reactivated.
            </p>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "1rem", fontSize: "0.85rem", cursor: "pointer" }}>
              <input type="checkbox" checked={hideFromReports} onChange={(e) => setHideFromReports(e.target.checked)} />
              Also hide from historical reports?
            </label>
            <div className="flex-row gap-sm">
              <button
                onClick={handleDeactivate}
                disabled={actingId === staff.id}
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
                {actingId === staff.id ? "Deactivating…" : "Deactivate"}
              </button>
              <button
                onClick={() => { setShowConfirmation(null); setHideFromReports(false); }}
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

      {showConfirmation === "delete" && (
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
            onClick={() => setShowConfirmation(null)}
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
              <h3 style={{ margin: 0, color: "#ba1a1a", fontSize: "1.05rem", fontWeight: 700 }}>Delete Staff</h3>
              <button
                onClick={() => setShowConfirmation(null)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.5rem", color: "#1F6B4D", lineHeight: 1, padding: "0.25rem" }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p style={{ margin: "0 0 1rem", fontSize: "0.9rem", color: "var(--color-text)" }}>
              Delete <strong>{staff.name}</strong>? This moves them to Trash and can be restored later.
            </p>
            <div className="flex-row gap-sm">
              <button
                onClick={handleDelete}
                disabled={actingId === staff.id}
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
                {actingId === staff.id ? "Deleting…" : "Delete"}
              </button>
              <button
                onClick={() => setShowConfirmation(null)}
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
