"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/modules/core/components/card";
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
    <div className="page-container" style={{ maxWidth: "100%" }}>
      <Link href="/staff" className="btn btn-ghost mb-2">
        ← Back to Staff
      </Link>

      <h1 className="page-title" style={{ marginBottom: "1.25rem" }}>
        {staff.name}
        <span
          style={{
            display: "inline-block",
            padding: "0.15rem 0.5rem",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.75rem",
            fontWeight: 600,
            backgroundColor: staff.role === "MANAGER" ? "var(--color-accent)" : "var(--color-muted)",
            color: staff.role === "STAFF" ? "var(--color-text)" : "#fff",
            marginLeft: "0.75rem",
            verticalAlign: "middle",
          }}
        >
          {staff.role}
        </span>
        {!staff.isActive && (
          <span
            style={{
              display: "inline-block",
              padding: "0.15rem 0.5rem",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.75rem",
              fontWeight: 600,
              backgroundColor: "var(--color-danger)",
              color: "#fff",
              marginLeft: "0.5rem",
              verticalAlign: "middle",
            }}
          >
            Inactive
          </span>
        )}
      </h1>

      <div className="card-grid card-grid--2" style={{ marginBottom: "1.25rem" }}>
        <Card>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--color-brand)", margin: "0 0 0.75rem" }}>
            Details
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div className="flex-row" style={{ justifyContent: "space-between" }}>
              <span className="text-sm text-muted">Email</span>
              <span style={{ fontWeight: 500 }}>{staff.email}</span>
            </div>
            <div className="flex-row" style={{ justifyContent: "space-between" }}>
              <span className="text-sm text-muted">Job Title</span>
              <span style={{ fontWeight: 500 }}>{staff.jobTitle?.name || "—"}</span>
            </div>
            <div className="flex-row" style={{ justifyContent: "space-between" }}>
              <span className="text-sm text-muted">Status</span>
              <StatusPill
                status={staff.isActive ? "present" : "absent"}
                label={staff.isActive ? "Active" : "Inactive"}
              />
            </div>
            <div className="flex-row" style={{ justifyContent: "space-between" }}>
              <span className="text-sm text-muted">Joined</span>
              <span style={{ fontWeight: 500 }}>{new Date(staff.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex-row gap-sm mt-2">
            {!showEdit && (
              <button onClick={() => setShowEdit(true)} className="btn btn-primary btn-sm">
                Edit
              </button>
            )}
            {staff.isActive ? (
              <>
                <button
                  onClick={() => setShowConfirmation("deactivate")}
                  disabled={actingId === staff.id}
                  className="btn btn-danger btn-sm"
                >
                  Deactivate
                </button>
                <button
                  onClick={() => setShowConfirmation("delete")}
                  disabled={actingId === staff.id}
                  className="btn btn-danger btn-sm"
                >
                  Delete
                </button>
              </>
            ) : (
              <button
                onClick={handleReactivate}
                disabled={actingId === staff.id}
                className="btn btn-success btn-sm"
              >
                Reactivate
              </button>
            )}
          </div>
        </Card>

        <Card>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--color-brand)", margin: "0 0 0.75rem" }}>
            Attendance
          </h2>
          <div className="flex-row gap-sm flex-wrap" style={{ marginBottom: "0.75rem" }}>
            <div>
              <label className="form-label" style={{ fontSize: "0.75rem" }}>Month</label>
              <select value={summaryMonth} onChange={(e) => { setSummaryMonth(Number(e.target.value)); setPage(0); }} className="form-select" style={{ minWidth: 130, fontSize: "0.8125rem" }}>
                {monthOptions.map((m) => (<option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>))}
              </select>
            </div>
            <div>
              <label className="form-label" style={{ fontSize: "0.75rem" }}>Year</label>
              <select value={summaryYear} onChange={(e) => { setSummaryYear(Number(e.target.value)); setPage(0); }} className="form-select" style={{ minWidth: 90, fontSize: "0.8125rem" }}>
                {yearOptions.map((y) => (<option key={y} value={y}>{y}</option>))}
              </select>
            </div>
          </div>
          <div className="flex-row" style={{ justifyContent: "space-around" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-success)" }}>{monthSummary.present}</div>
              <div className="text-sm text-muted">Present</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-danger)" }}>{monthSummary.absent}</div>
              <div className="text-sm text-muted">Absent</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-accent)" }}>{monthSummary.leave}</div>
              <div className="text-sm text-muted">Leave</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-muted)" }}>{monthSummary.pending}</div>
              <div className="text-sm text-muted">Pending</div>
            </div>
          </div>
        </Card>
      </div>

      {showEdit && (
        <Card style={{ marginBottom: "1.25rem" }}>
          <form onSubmit={handleSaveEdit}>
            <h3 style={{ marginTop: 0, color: "var(--color-brand)", fontSize: "1rem" }}>Edit Staff</h3>
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
        </Card>
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

      <h2 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--color-brand)", margin: "0 0 0.75rem" }}>
        Leave Balances
      </h2>

      {balances.length === 0 ? (
        <Card><p className="text-muted text-center" style={{ padding: "1rem 0", margin: 0 }}>No leave types configured.</p></Card>
      ) : (
        <div className="card-grid" style={{ marginBottom: "1.25rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {balances.map((b) => {
            const maxVal = Math.max(b.granted, b.remaining + b.used);
            return (
              <Card key={b.leaveTypeId} hover style={{ padding: "1rem" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", textAlign: "center" }}>
                    {b.leaveTypeName}
                    {b.isAnnualRecurring && <span className="text-sm text-muted" style={{ marginLeft: "0.35rem" }}>(annual)</span>}
                  </div>
                  <RadialGauge value={b.remaining} max={maxVal} size={100} strokeWidth={8} />
                  <div className="flex-row gap-md" style={{ justifyContent: "center" }}>
                    <div style={{ textAlign: "center" }}>
                      <div className="text-sm text-muted">Granted</div>
                      <div style={{ fontWeight: 600 }}>{formatDays(b.granted)}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div className="text-sm text-muted">Used</div>
                      <div style={{ fontWeight: 600 }}>{formatDays(b.used)}</div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Documents — manager only */}
      <h2 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--color-brand)", margin: "0 0 0.75rem" }}>
        Documents
      </h2>

      {docError && <p className="form-error mb-2">{docError}</p>}
      {docSuccess && <p className="form-success mb-2">{docSuccess}</p>}

      <Card style={{ marginBottom: "1.25rem" }}>
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
      </Card>

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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <h2 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--color-brand)", margin: 0, paddingTop: "0.35rem" }}>
          Request History
        </h2>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", flexWrap: "wrap" }}>
          <div>
            <label className="form-label" style={{ fontSize: "0.7rem", marginBottom: 2 }}>Type</label>
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setPage(0); }}
              className="form-select"
              style={{ minWidth: 120, fontSize: "0.8125rem" }}
            >
              <option value="all">All types</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="PERMISSION">Permission</option>
              <option value="ANNUAL_LEAVE">Annual Leave</option>
              <option value="OTHER">Other</option>
              <option value="FIELD_WORK">Field Work</option>
            </select>
          </div>
          <div>
            <label className="form-label" style={{ fontSize: "0.7rem", marginBottom: 2 }}>Status</label>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
              className="form-select"
              style={{ minWidth: 110, fontSize: "0.8125rem" }}
            >
              <option value="all">All statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
            </select>
          </div>
          <div>
            <label className="form-label" style={{ fontSize: "0.7rem", marginBottom: 2 }}>From</label>
            <input
              type="date"
              className="form-input"
              value={filterFromDate}
              onChange={(e) => { setFilterFromDate(e.target.value); setPage(0); }}
              style={{ minWidth: 135, fontSize: "0.8125rem", padding: "0.35rem 0.5rem" }}
            />
          </div>
          <div>
            <label className="form-label" style={{ fontSize: "0.7rem", marginBottom: 2 }}>To</label>
            <input
              type="date"
              className="form-input"
              value={filterToDate}
              onChange={(e) => { setFilterToDate(e.target.value); setPage(0); }}
              style={{ minWidth: 135, fontSize: "0.8125rem", padding: "0.35rem 0.5rem" }}
            />
          </div>
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <Card><p className="text-muted text-center" style={{ padding: "1rem 0", margin: 0 }}>No records found.</p></Card>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-responsive">
          <table className="table-card" style={{ boxShadow: "none", border: "none", borderRadius: 0 }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th style={{ textAlign: "center" }}>Status</th>
                <th>Note</th>
                <th>Attachment</th>
              </tr>
            </thead>
            <tbody>
              {pagedRecords.map((r) => {
                const displayType = r.requestedStatus === "FIELD_WORK"
                  ? "Field Work"
                  : r.leaveTypeName ?? formatAttendanceStatus(r.requestedStatus);
                const label = r.count > 1
                  ? `${displayType} (${r.count} days)`
                  : displayType;
                return (
                <tr key={r.firstId}>
                  <td data-label="Date" style={{ whiteSpace: "nowrap" }}>{r.dateRange}</td>
                  <td data-label="Type">{label}</td>
                  <td data-label="Status" style={{ textAlign: "center" }}>
                    <StatusPill status={getStatusVariant(r.status, r.reviewedBy)} label={getStatusLabel(r.status, r.reviewedBy)} />
                  </td>
                  <td data-label="Note" className="text-muted">{r.note || "\u2014"}</td>
                  <td data-label="Attachment">
                    {r.attachmentUrl ? (
                      <div className="flex-row gap-sm">
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
          {totalPages > 1 && (
            <div className="flex-row" style={{ justifyContent: "center", gap: "0.5rem", padding: "0.75rem", borderTop: "1px solid var(--color-border)" }}>
              <button
                onClick={() => setPage(Math.max(0, clampedPage - 1))}
                disabled={clampedPage === 0}
                className="btn btn-ghost btn-sm"
              >
                ← Prev
              </button>
              <span className="text-sm text-muted">
                Page {clampedPage + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, clampedPage + 1))}
                disabled={clampedPage >= totalPages - 1}
                className="btn btn-ghost btn-sm"
              >
                Next →
              </button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
