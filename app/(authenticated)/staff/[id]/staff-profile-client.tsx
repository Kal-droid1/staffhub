"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StatusPill from "@/modules/core/components/status-pill";
import RadialGauge from "@/modules/core/components/radial-gauge";
import { formatDays, formatAttendanceStatus, formatDate } from "@/lib/format";

interface StaffMember {
  id: string;
  name: string;
  username: string;
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

interface LeaveTypeOption {
  id: string;
  name: string;
  isAnnualRecurring: boolean;
  mappedStatus: string;
  defaultDays: number;
}

interface LeaveGrantApiRow {
  id: string;
  days: number;
  grantedDate: string;
  note: string | null;
  expiresAt: string | null;
  leaveType: { id: string; name: string };
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
  currentUserId: string;
  staff: StaffMember;
  balances: Balance[];
  records: RecordRow[];
  grants: GrantRow[];
  documents: DocumentCategory[];
  leaveTypes: LeaveTypeOption[];
}

const ROLE_OPTIONS = ["STAFF", "MANAGER"];
const PAGE_SIZE = 5;

const AVATAR_BG: Record<string, string> = {
  STAFF: "#6b7b6f",
  MANAGER: "#D9A441",
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function StaffProfileClient({ currentUserId, staff, balances, records, grants: initialGrants, documents: initialDocuments, leaveTypes }: Props) {
  const router = useRouter();

  const isSelf = staff.id === currentUserId;

  const [jobTitles, setJobTitles] = useState<JobTitleOption[]>([]);

  const [grants, setGrants] = useState<GrantRow[]>(initialGrants);
  const [balancesState, setBalancesState] = useState<Balance[]>(balances);
  const [showGrantsModal, setShowGrantsModal] = useState(false);
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [editingGrantId, setEditingGrantId] = useState<string | null>(null);
  const [grantTypeId, setGrantTypeId] = useState(leaveTypes[0]?.id ?? "");
  const [grantDays, setGrantDays] = useState(leaveTypes[0]?.defaultDays ?? 20);
  const [grantDate, setGrantDate] = useState(adisToday());
  const [grantNote, setGrantNote] = useState("");
  const [grantSaving, setGrantSaving] = useState(false);
  const [grantError, setGrantError] = useState("");
  const [deletingGrantId, setDeletingGrantId] = useState<string | null>(null);
  const [deletingBalance, setDeletingBalance] = useState<Balance | null>(null);
  const [balanceDeleteError, setBalanceDeleteError] = useState("");
  const [balanceDeleting, setBalanceDeleting] = useState(false);

  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

  const [showEdit, setShowEdit] = useState(false);
  const [editingName, setEditingName] = useState(staff.name);
  const [editingUsername, setEditingUsername] = useState(staff.username);
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
  const [balanceIndex, setBalanceIndex] = useState(0);

  const filteredBalances = balancesState.filter((b) => b.granted > 0);

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
        ? `${formatDate(first.date)} \u2013 ${formatDate(last.date)}`
        : formatDate(first.date);

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
    if (!editingName.trim() || !editingUsername.trim()) return;
    setSaving(true);
    setError("");

    const res = await fetch("/api/staff", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: staff.id,
        name: editingName.trim(),
        username: editingUsername.trim(),
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

  function openResetPassword() {
    setResetNewPassword("");
    setResetConfirmPassword("");
    setResetError("");
    setResetSuccess("");
    setShowResetPassword(true);
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetError("");
    setResetSuccess("");

    if (resetNewPassword !== resetConfirmPassword) {
      setResetError("New passwords do not match.");
      return;
    }
    if (resetNewPassword.length < 8) {
      setResetError("New password must be at least 8 characters.");
      return;
    }

    setResetSaving(true);
    const res = await fetch("/api/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: staff.id, action: "reset-password", newPassword: resetNewPassword }),
    });
    const data = await res.json();

    if (!res.ok) {
      setResetError(data.error || "Failed to reset password.");
      setResetSaving(false);
      return;
    }

    setResetSuccess("Password reset successfully.");
    setResetNewPassword("");
    setResetConfirmPassword("");
    setResetSaving(false);
    router.refresh();
  }

  async function refreshProfileBalances() {
    const res = await fetch(`/api/leave-balances?userId=${encodeURIComponent(staff.id)}`);
    const data = await res.json();
    if (res.ok) setBalancesState(data.balances);
  }

  function openAddGrant() {
    setEditingGrantId(null);
    setGrantTypeId(leaveTypes[0]?.id ?? "");
    setGrantDays(leaveTypes[0]?.defaultDays ?? 20);
    setGrantDate(adisToday());
    setGrantNote("");
    setGrantError("");
    setShowGrantForm(true);
  }

  function openEditGrant(g: GrantRow) {
    setEditingGrantId(g.id);
    setGrantDays(g.days);
    setGrantDate(g.grantedDate.slice(0, 10));
    setGrantNote(g.note ?? "");
    setGrantError("");
    setShowGrantForm(true);
  }

  async function handleSaveGrant(e: React.FormEvent) {
    e.preventDefault();
    if (grantDays <= 0) return;
    setGrantSaving(true);
    setGrantError("");

    const url = "/api/leave-grants";
    const method = editingGrantId ? "PUT" : "POST";
    const body: Record<string, unknown> = editingGrantId
      ? { id: editingGrantId, days: grantDays, grantedDate: grantDate, note: grantNote || undefined }
      : { userId: staff.id, leaveTypeId: grantTypeId, days: grantDays, grantedDate: grantDate, note: grantNote || undefined };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      setGrantError(data.error || "Failed to save grant.");
      setGrantSaving(false);
      return;
    }

    const grantsRes = await fetch(`/api/leave-grants?userId=${encodeURIComponent(staff.id)}`);
    const grantsData = await grantsRes.json();
    if (grantsRes.ok) {
      setGrants(grantsData.map((g: LeaveGrantApiRow) => ({
        id: g.id,
        leaveTypeName: g.leaveType.name,
        days: g.days,
        grantedDate: g.grantedDate,
        note: g.note,
        expiresAt: g.expiresAt,
      })));
    }

    await refreshProfileBalances();

    setShowGrantForm(false);
    setEditingGrantId(null);
    setGrantSaving(false);
    router.refresh();
  }

  async function handleDeleteGrant(grantId: string) {
    setDeletingGrantId(grantId);
    const res = await fetch(`/api/leave-grants?id=${encodeURIComponent(grantId)}`, { method: "DELETE" });
    if (res.ok) {
      setGrants((prev) => prev.filter((g) => g.id !== grantId));
      await refreshProfileBalances();
      router.refresh();
    }
    setDeletingGrantId(null);
  }

  async function confirmDeleteBalance() {
    if (!deletingBalance) return;
    setBalanceDeleting(true);
    setBalanceDeleteError("");
    const res = await fetch(
      `/api/leave-grants?userId=${encodeURIComponent(staff.id)}&leaveTypeId=${encodeURIComponent(deletingBalance.leaveTypeId)}`,
      { method: "DELETE" }
    );
    const data = await res.json();

    if (!res.ok) {
      setBalanceDeleteError(data.error || "Failed to remove leave grant.");
      setBalanceDeleting(false);
      return;
    }

    setDeletingBalance(null);
    setBalanceDeleting(false);
    setBalanceIndex((idx) => Math.max(0, Math.min(idx, filteredBalances.length - 2)));
    await refreshProfileBalances();
    router.refresh();
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

      {/* Two-column layout: Details + Leave Balances (left) | Attendance Snapshot + Documents (right) */}
      <div className="stack-mobile" style={{
        display: "grid",
        gridTemplateColumns: "1fr 2fr",
        alignItems: "start",
        gap: "1.5rem",
        marginBottom: "1.5rem",
      }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
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
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.9rem",
            paddingBottom: "1.25rem",
            borderBottom: "1px solid rgba(191,201,193,0.3)",
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: AVATAR_BG[staff.role] ?? AVATAR_BG.STAFF,
              color: "#fff",
              border: "2px solid #fff",
              boxShadow: "0 4px 14px rgba(31, 107, 77, 0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.1rem",
              fontWeight: 700,
              flexShrink: 0,
            }}>
              {getInitials(staff.name)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", minWidth: 0 }}>
              <span style={{
                fontSize: "1.05rem",
                fontWeight: 800,
                color: "#1F6B4D",
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
                wordBreak: "break-word",
              }}>
                {staff.name}
              </span>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                <span style={{
                  display: "inline-block",
                  padding: "0.15rem 0.7rem",
                  borderRadius: "999px",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  backgroundColor: staff.role === "MANAGER" ? "#D9A441" : "var(--color-muted)",
                  color: staff.role === "MANAGER" ? "#fff" : "var(--color-text)",
                  border: staff.role === "MANAGER" ? "none" : "1px solid rgba(191,201,193,0.3)",
                  boxShadow: staff.role === "MANAGER" ? "0 2px 8px rgba(217,164,65,0.4)" : "none",
                  whiteSpace: "nowrap",
                }}>
                  {staff.role}
                </span>
                {!staff.isActive && (
                  <span style={{
                    display: "inline-block",
                    padding: "0.15rem 0.7rem",
                    borderRadius: "999px",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    backgroundColor: "#ba1a1a",
                    color: "#fff",
                    whiteSpace: "nowrap",
                  }}>
                    Inactive
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", padding: "0.85rem 0", borderBottom: "1px solid rgba(191,201,193,0.25)" }}>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "0.2rem 0.7rem",
                borderRadius: "999px",
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.03em",
                backgroundColor: "rgba(31,107,77,0.1)",
                color: "#1F6B4D",
                border: "1px solid rgba(31,107,77,0.3)",
                whiteSpace: "nowrap",
              }}>
                Username
              </span>
              <span style={{ fontWeight: 600, fontSize: "0.875rem", textAlign: "right", wordBreak: "break-word" }}>{staff.username}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", padding: "0.85rem 0", borderBottom: "1px solid rgba(191,201,193,0.25)" }}>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "0.2rem 0.7rem",
                borderRadius: "999px",
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.03em",
                backgroundColor: "rgba(217,164,65,0.18)",
                color: "#7d5700",
                border: "1px solid rgba(217,164,65,0.4)",
                whiteSpace: "nowrap",
              }}>
                Job Title
              </span>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "0.2rem 0.7rem",
                borderRadius: "999px",
                fontSize: "0.72rem",
                fontWeight: 700,
                backgroundColor: "rgba(31,107,77,0.1)",
                color: "#1F6B4D",
                border: "1px solid rgba(31,107,77,0.3)",
                whiteSpace: "nowrap",
              }}>
                {staff.jobTitle?.name || "\u2014"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", padding: "0.85rem 0", borderBottom: "1px solid rgba(191,201,193,0.25)" }}>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "0.2rem 0.7rem",
                borderRadius: "999px",
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.03em",
                backgroundColor: "rgba(31,107,77,0.1)",
                color: "#1F6B4D",
                border: "1px solid rgba(31,107,77,0.3)",
                whiteSpace: "nowrap",
              }}>
                Status
              </span>
              <StatusPill
                status={staff.isActive ? "present" : "absent"}
                label={staff.isActive ? "Active" : "Inactive"}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", padding: "0.85rem 0" }}>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "0.2rem 0.7rem",
                borderRadius: "999px",
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.03em",
                backgroundColor: "rgba(217,164,65,0.18)",
                color: "#7d5700",
                border: "1px solid rgba(217,164,65,0.4)",
                whiteSpace: "nowrap",
              }}>
                Joined
              </span>
              <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{formatDate(staff.createdAt)}</span>
            </div>
          </div>
          <div className="wrap-mobile" style={{ display: "flex", gap: "0.5rem", paddingTop: "1rem", borderTop: "1px solid rgba(191,201,193,0.3)" }}>
            <button
              onClick={() => setShowGrantsModal(true)}
              style={{
                flex: 1,
                padding: "0.5rem 1rem",
                background: "rgba(217,164,65,0.08)",
                border: "1px solid #D9A441",
                borderRadius: "0.35rem",
                color: "#7d5700",
                fontWeight: 600,
                fontSize: "0.8125rem",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "background 0.2s ease, color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#D9A441";
                e.currentTarget.style.color = "#0A261B";
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 16px rgba(217,164,65,0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(217,164,65,0.08)";
                e.currentTarget.style.color = "#7d5700";
                e.currentTarget.style.transform = "";
                e.currentTarget.style.boxShadow = "";
              }}
            >
              Leave Grants
            </button>
            <button
              onClick={openResetPassword}
              style={{
                flex: 1,
                padding: "0.5rem 1rem",
                background: "rgba(31,107,77,0.08)",
                border: "1px solid #1F6B4D",
                borderRadius: "0.35rem",
                color: "#1F6B4D",
                fontWeight: 600,
                fontSize: "0.8125rem",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "background 0.2s ease, color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#1F6B4D";
                e.currentTarget.style.color = "#fff";
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 16px rgba(31,107,77,0.35)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(31,107,77,0.08)";
                e.currentTarget.style.color = "#1F6B4D";
                e.currentTarget.style.transform = "";
                e.currentTarget.style.boxShadow = "";
              }}
            >
              Reset Password
            </button>
            {!showEdit && (
              <button
                onClick={() => setShowEdit(true)}
                style={{
                  flex: 1,
                  padding: "0.5rem 1rem",
                  background: "rgba(31,107,77,0.08)",
                  border: "1px solid #1F6B4D",
                  borderRadius: "0.35rem",
                  color: "#1F6B4D",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "background 0.2s ease, color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#1F6B4D";
                  e.currentTarget.style.color = "#fff";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(31,107,77,0.35)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(31,107,77,0.08)";
                  e.currentTarget.style.color = "#1F6B4D";
                  e.currentTarget.style.transform = "";
                  e.currentTarget.style.boxShadow = "";
                }}
              >
                Edit
              </button>
            )}
            {staff.isActive ? (
              <>
                <button
                  onClick={() => setShowConfirmation("deactivate")}
                  disabled={isSelf || actingId === staff.id}
                  title={isSelf ? "You cannot deactivate your own account" : "Deactivate"}
                  style={{
                    flex: 1,
                    padding: "0.5rem 1rem",
                    background: "rgba(120,100,60,0.06)",
                    border: "1px solid rgba(120,100,60,0.5)",
                    borderRadius: "0.35rem",
                    color: "#6b5a33",
                    fontWeight: 600,
                    fontSize: "0.8125rem",
                    cursor: isSelf ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    opacity: isSelf ? 0.4 : 1,
                    transition: "background 0.2s ease, color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(217,164,65,0.35)";
                    e.currentTarget.style.color = "#4a3c1f";
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 6px 16px rgba(217,164,65,0.25)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(120,100,60,0.06)";
                    e.currentTarget.style.color = "#6b5a33";
                    e.currentTarget.style.transform = "";
                    e.currentTarget.style.boxShadow = "";
                  }}
                >
                  Deactivate
                </button>
                <button
                  onClick={() => setShowConfirmation("delete")}
                  disabled={isSelf || actingId === staff.id}
                  title={isSelf ? "You cannot delete your own account" : "Delete"}
                  style={{
                    flex: 1,
                    padding: "0.5rem 1rem",
                    background: "rgba(186,26,26,0.06)",
                    border: "1px solid #ba1a1a",
                    borderRadius: "0.35rem",
                    color: "#ba1a1a",
                    fontWeight: 600,
                    fontSize: "0.8125rem",
                    cursor: isSelf ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    opacity: isSelf ? 0.4 : 1,
                    transition: "background 0.2s ease, color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#ba1a1a";
                    e.currentTarget.style.color = "#fff";
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 6px 16px rgba(186,26,26,0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(186,26,26,0.06)";
                    e.currentTarget.style.color = "#ba1a1a";
                    e.currentTarget.style.transform = "";
                    e.currentTarget.style.boxShadow = "";
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
                  background: "rgba(31,107,77,0.08)",
                  border: "1px solid #1F6B4D",
                  borderRadius: "0.35rem",
                  color: "#1F6B4D",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "background 0.2s ease, color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#1F6B4D";
                  e.currentTarget.style.color = "#fff";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(31,107,77,0.35)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(31,107,77,0.08)";
                  e.currentTarget.style.color = "#1F6B4D";
                  e.currentTarget.style.transform = "";
                  e.currentTarget.style.boxShadow = "";
                }}
              >
                Reactivate
              </button>
            )}
          </div>
        </section>

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
          {filteredBalances.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "2rem 0" }}>No leave types assigned yet.</p>
          ) : (
            (() => {
              const b = filteredBalances[Math.min(balanceIndex, filteredBalances.length - 1)];
              const maxVal = Math.max(b.granted, b.remaining + b.used);
              return (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <button
                      type="button"
                      onClick={() => setBalanceIndex(Math.max(0, balanceIndex - 1))}
                      disabled={balanceIndex === 0}
                      aria-label="Previous leave type"
                      style={{
                        background: "rgba(255,255,255,0.5)",
                        color: "#1F6B4D",
                        border: "1px solid rgba(191,201,193,0.3)",
                        borderRadius: "0.25rem",
                        width: 28,
                        height: 28,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: balanceIndex === 0 ? "default" : "pointer",
                        fontSize: "0.85rem",
                        fontFamily: "inherit",
                        outline: "none",
                        opacity: balanceIndex === 0 ? 0.4 : 1,
                      }}
                    >
                      ←
                    </button>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1F6B4D" }}>
                        {b.leaveTypeName}
                        {b.isAnnualRecurring && <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginLeft: "0.35rem" }}>(annual)</span>}
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                        ({balanceIndex + 1}/{filteredBalances.length})
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBalanceIndex(Math.min(filteredBalances.length - 1, balanceIndex + 1))}
                      disabled={balanceIndex === filteredBalances.length - 1}
                      aria-label="Next leave type"
                      style={{
                        background: "rgba(255,255,255,0.5)",
                        color: "#1F6B4D",
                        border: "1px solid rgba(191,201,193,0.3)",
                        borderRadius: "0.25rem",
                        width: 28,
                        height: 28,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: balanceIndex === filteredBalances.length - 1 ? "default" : "pointer",
                        fontSize: "0.85rem",
                        fontFamily: "inherit",
                        outline: "none",
                        opacity: balanceIndex === filteredBalances.length - 1 ? 0.4 : 1,
                      }}
                    >
                      →
                    </button>
                  </div>
                  <RadialGauge value={b.remaining} max={maxVal} size={180} strokeWidth={10} gradient />
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginTop: "0.5rem", marginBottom: "0.25rem" }}>
                    Days Left
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
                  <div style={{ display: "flex", justifyContent: "center", marginTop: "0.75rem" }}>
                    <button
                      type="button"
                      onClick={() => { setBalanceDeleteError(""); setDeletingBalance(b); }}
                      title="Remove this leave grant"
                      aria-label="Remove this leave grant"
                      style={{
                        background: "rgba(255,255,255,0.5)",
                        color: "#ba1a1a",
                        border: "1px solid rgba(186,26,26,0.4)",
                        borderRadius: "0.25rem",
                        width: 28,
                        height: 28,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        outline: "none",
                        padding: 0,
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>delete</span>
                    </button>
                  </div>
                </div>
              );
            })()
          )}
        </section>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
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
                <div style={{ display: "flex", alignItems: "center", gap: "0.15rem" }}>
                  <button
                    onClick={() => { setSummaryYear(summaryYear - 1); setPage(0); }}
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: "0.25rem",
                      width: 28,
                      height: 28,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      fontFamily: "inherit",
                      outline: "none",
                    }}
                    aria-label="Previous year"
                  >
                    ←
                  </button>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.8125rem", minWidth: "2.5rem", textAlign: "center" }}>
                    {summaryYear}
                  </span>
                  <button
                    onClick={() => { setSummaryYear(summaryYear + 1); setPage(0); }}
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: "0.25rem",
                      width: 28,
                      height: 28,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      fontFamily: "inherit",
                      outline: "none",
                    }}
                    aria-label="Next year"
                  >
                    →
                  </button>
                </div>
              </div>
            </div>
            <div className="grid-2-mobile" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
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

        {/* Documents — card-grid layout */}
        <section>
          <h2 style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#1F6B4D", fontFamily: "var(--font-mono)", margin: "0 0 0.75rem" }}>
            Documents
          </h2>

          {docError && <p className="form-error mb-2">{docError}</p>}
          {docSuccess && <p className="form-success mb-2">{docSuccess}</p>}

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "0.75rem",
            marginBottom: "1.25rem",
          }}>
            {documents.map((cat) => {
              const latest = cat.files[0] ?? null;
              const hasHistory = cat.files.length > 1;
              const isExpanded = expandedCategory === cat.category;
              const isUploaded = !!latest;

              return (
                <div
                  key={cat.category}
                  style={{
                    background: isUploaded ? "rgba(250, 247, 240, 0.85)" : "rgba(250, 247, 240, 0.5)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    border: isUploaded
                      ? "1px solid rgba(255, 255, 255, 0.4)"
                      : "1px dashed rgba(217, 164, 65, 0.4)",
                    borderLeft: isUploaded ? "3px solid #1F6B4D" : "3px solid #D9A441",
                    borderRadius: "0.5rem",
                    boxShadow: isUploaded
                      ? "0 4px 16px rgba(31, 107, 77, 0.06), 0 2px 4px rgba(0,0,0,0.03)"
                      : "none",
                    padding: "1rem",
                    transition: "all 0.2s ease",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  {/* Category header */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: "6px",
                      background: isUploaded ? "#1F6B4D" : "rgba(217,164,65,0.15)",
                      color: isUploaded ? "#fff" : "#D9A441",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.85rem",
                      flexShrink: 0,
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
                        {isUploaded ? "description" : "upload_file"}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: 700, color: isUploaded ? "#1F6B4D" : "var(--color-text)", lineHeight: 1.3 }}>
                      {cat.category}
                    </p>
                  </div>

                  {isUploaded ? (
                    <>
                      {/* File info */}
                      <div style={{
                        background: "rgba(255,255,255,0.6)",
                        borderRadius: "0.35rem",
                        padding: "0.5rem 0.6rem",
                        fontSize: "0.7rem",
                        border: "1px solid rgba(191,201,193,0.2)",
                      }}>
                        <div style={{ fontWeight: 600, color: "var(--color-text)", marginBottom: "0.15rem", wordBreak: "break-all" }}>
                          {latest.fileName}
                        </div>
                        <div style={{ color: "var(--color-text-muted)" }}>
                          {formatDate(latest.uploadedAt)} by {latest.uploadedByName}
                        </div>
                        {hasHistory && (
                          <div style={{ marginTop: "0.2rem", color: "#1F6B4D", fontWeight: 600, fontSize: "0.65rem" }}>
                            +{cat.files.length - 1} older version{cat.files.length > 2 ? "s" : ""}
                          </div>
                        )}
                      </div>

                      {/* Actions row */}
                      <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                        <a
                          href={`/api/attachments?url=${encodeURIComponent(latest.fileUrl)}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.2rem",
                            padding: "0.3rem 0.5rem",
                            background: "none",
                            border: "1px solid rgba(191,201,193,0.4)",
                            borderRadius: "0.35rem",
                            color: "#1F6B4D",
                            fontSize: "0.65rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            textDecoration: "none",
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(31,107,77,0.06)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "0.85rem" }}>visibility</span>
                          View
                        </a>
                        <a
                          href={`/api/attachments?url=${encodeURIComponent(latest.fileUrl)}&download=1`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.2rem",
                            padding: "0.3rem 0.5rem",
                            background: "none",
                            border: "1px solid rgba(191,201,193,0.4)",
                            borderRadius: "0.35rem",
                            color: "#1F6B4D",
                            fontSize: "0.65rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            textDecoration: "none",
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(31,107,77,0.06)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "0.85rem" }}>download</span>
                          Download
                        </a>
                        <button
                          onClick={() => setDeleteTarget({ docId: latest.id, category: cat.category, isLatest: true, hasPrevious: cat.files.length > 1 })}
                          disabled={deletingId === latest.id}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.2rem",
                            padding: "0.3rem 0.5rem",
                            background: "none",
                            border: "1px solid rgba(186,26,26,0.3)",
                            borderRadius: "0.35rem",
                            color: "#ba1a1a",
                            fontSize: "0.65rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(186,26,26,0.06)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "0.85rem" }}>delete</span>
                          {deletingId === latest.id ? "…" : "Delete"}
                        </button>
                        <label style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.2rem",
                          padding: "0.3rem 0.5rem",
                          background: "#1F6B4D",
                          color: "#fff",
                          border: "none",
                          borderRadius: "0.35rem",
                          fontSize: "0.65rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          boxShadow: "0 1px 3px rgba(31,107,77,0.2)",
                          position: "relative",
                          transition: "background 0.15s",
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "0.85rem" }}>swap_horiz</span>
                          {uploadingCategory === cat.category ? "Uploading..." : "Replace"}
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

                      {/* Version history toggle */}
                      {hasHistory && (
                        <>
                          <button
                            onClick={() => setExpandedCategory(isExpanded ? null : cat.category)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "0.65rem",
                              color: "#1F6B4D",
                              fontWeight: 600,
                              padding: 0,
                              textAlign: "left",
                              fontFamily: "inherit",
                            }}
                          >
                            {isExpanded ? "Hide version history" : `View ${cat.files.length - 1} previous version${cat.files.length > 2 ? "s" : ""}`} →
                          </button>
                          {isExpanded && (
                            <div style={{
                              borderLeft: "2px solid rgba(31,107,77,0.2)",
                              paddingLeft: "0.6rem",
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.35rem",
                            }}>
                              {cat.files.slice(1).map((f) => (
                                <div key={f.id} style={{ fontSize: "0.65rem", display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                                  <div style={{ fontWeight: 600, color: "var(--color-text)", wordBreak: "break-all" }}>
                                    {f.fileName}
                                  </div>
                                  <div style={{ color: "var(--color-text-light)" }}>
                                    {formatDate(f.uploadedAt)} by {f.uploadedByName}
                                  </div>
                                  <div style={{ display: "flex", gap: "0.25rem" }}>
                                    <a
                                      href={`/api/attachments?url=${encodeURIComponent(f.fileUrl)}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ fontSize: "0.6rem", color: "#1F6B4D", textDecoration: "none", fontWeight: 600 }}
                                    >
                                      View
                                    </a>
                                    <a
                                      href={`/api/attachments?url=${encodeURIComponent(f.fileUrl)}&download=1`}
                                      style={{ fontSize: "0.6rem", color: "#1F6B4D", textDecoration: "none", fontWeight: 600 }}
                                    >
                                      Download
                                    </a>
                                    <button
                                      onClick={() => setDeleteTarget({ docId: f.id, category: cat.category, isLatest: false, hasPrevious: false })}
                                      disabled={deletingId === f.id}
                                      style={{
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        fontSize: "0.6rem",
                                        color: "#ba1a1a",
                                        fontWeight: 600,
                                        padding: 0,
                                        fontFamily: "inherit",
                                      }}
                                    >
                                      {deletingId === f.id ? "…" : "Delete"}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    /* Empty state */
                    <>
                      <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--color-text-light)", fontStyle: "italic" }}>
                        Not uploaded yet
                      </p>
                      <label style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.3rem",
                        padding: "0.5rem 0.75rem",
                        background: "#D9A441",
                        color: "#0A261B",
                        border: "none",
                        borderRadius: "0.35rem",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        boxShadow: "0 2px 8px rgba(217,164,65,0.3)",
                        position: "relative",
                        marginTop: "0.25rem",
                        transition: "background 0.15s",
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "0.9rem" }}>upload</span>
                        {uploadingCategory === cat.category ? "Uploading..." : "Upload"}
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
                    </>
                  )}
                </div>
              );
            })}
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
                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
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
                        <span style={{ color: "var(--color-text-light)" }}>{"\u2014"}</span>
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
                <label className="form-label">Username</label>
                <input type="text" className="form-input" value={editingUsername} onChange={(e) => setEditingUsername(e.target.value)} required />
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

      {/* Leave Grants modal */}
      {showGrantsModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 110,
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
            onClick={() => setShowGrantsModal(false)}
          />
          <div
            style={{
              position: "relative",
              background: "#FAF7F0",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.4)",
              boxShadow: "0 20px 40px rgba(31, 107, 77, 0.25)",
              borderTop: "4px solid #D9A441",
              maxWidth: 760,
              width: "calc(100% - 2rem)",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              margin: "0 1rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem 0", flexShrink: 0 }}>
              <h3 style={{ margin: 0, color: "#1F6B4D", fontSize: "1.1rem", fontWeight: 700 }}>
                Leave Grants — {staff.name}
              </h3>
              <button
                onClick={() => setShowGrantsModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.5rem", color: "#1F6B4D", lineHeight: 1, padding: "0.25rem" }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: "1rem 1.5rem 1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem" }}>
                <button
                  onClick={openAddGrant}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    padding: "0.4rem 0.9rem",
                    background: "#D9A441",
                    color: "#0A261B",
                    border: "none",
                    borderRadius: "0.35rem",
                    fontWeight: 700,
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    boxShadow: "0 2px 8px rgba(217,164,65,0.3)",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>add</span>
                  Add Grant
                </button>
              </div>

              {grants.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-muted)" }}>
                  No grants for this staff member.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table-card" style={{ boxShadow: "none", border: "none", borderRadius: 0, width: "100%" }}>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th style={{ textAlign: "center" }}>Days</th>
                        <th>Granted</th>
                        <th>Expires</th>
                        <th>Note</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grants.map((g) => (
                        <tr key={g.id}>
                          <td data-label="Type" style={{ fontWeight: 600 }}>{g.leaveTypeName}</td>
                          <td data-label="Days" style={{ textAlign: "center", fontWeight: 600 }}>{formatDays(g.days)}</td>
                          <td data-label="Granted">{g.grantedDate.slice(0, 10)}</td>
                          <td data-label="Expires">{g.expiresAt ? g.expiresAt.slice(0, 10) : "Never"}</td>
                          <td data-label="Note" className="text-muted">{g.note || "\u2014"}</td>
                          <td data-label="Actions" style={{ whiteSpace: "nowrap" }}>
                            <div className="flex-row gap-sm">
                              <button
                                onClick={() => openEditGrant(g)}
                                className="btn btn-primary btn-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteGrant(g.id)}
                                disabled={deletingGrantId === g.id}
                                className="btn btn-danger btn-sm"
                              >
                                {deletingGrantId === g.id ? "…" : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Grant form modal */}
      {showGrantForm && (
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
            onClick={() => { setShowGrantForm(false); setEditingGrantId(null); setGrantError(""); }}
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
              <h3 style={{ margin: 0, color: "#1F6B4D", fontSize: "1.1rem", fontWeight: 700 }}>
                {editingGrantId ? "Edit Grant" : `Add Grant for ${staff.name}`}
              </h3>
              <button
                onClick={() => { setShowGrantForm(false); setEditingGrantId(null); setGrantError(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.5rem", color: "#1F6B4D", lineHeight: 1, padding: "0.25rem" }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveGrant}>
              {!editingGrantId && (
                <div style={{ marginBottom: "0.75rem" }}>
                  <label className="form-label">Leave Type</label>
                  {leaveTypes.length === 0 ? (
                    <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem", color: "#7d5700", background: "rgba(217,164,65,0.12)", border: "1px solid rgba(217,164,65,0.4)", borderRadius: "0.5rem", padding: "0.6rem 0.75rem" }}>
                      No leave types configured. Add one in Settings → Leave Types first.
                    </p>
                  ) : (
                    <select
                      value={grantTypeId}
                      onChange={(e) => {
                        const selected = leaveTypes.find((t) => t.id === e.target.value);
                        setGrantTypeId(e.target.value);
                        if (selected) setGrantDays(selected.defaultDays);
                      }}
                      className="form-select"
                    >
                      {leaveTypes.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <label className="form-label">Days</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={grantDays}
                    onChange={(e) => setGrantDays(Number(e.target.value))}
                    className="form-input"
                  />
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label className="form-label">Grant Date</label>
                  <input
                    type="date"
                    value={grantDate}
                    onChange={(e) => setGrantDate(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label className="form-label">Note (optional)</label>
                <input
                  type="text"
                  value={grantNote}
                  onChange={(e) => setGrantNote(e.target.value)}
                  className="form-input"
                  placeholder="e.g. Annual leave 2026"
                />
              </div>
              {grantError && <p className="form-error mb-1">{grantError}</p>}
              <div className="flex-row gap-sm">
                <button type="submit" disabled={grantSaving || (!editingGrantId && leaveTypes.length === 0)} className="btn btn-success">
                  {grantSaving ? "Saving..." : editingGrantId ? "Update" : "Add Grant"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => { setShowGrantForm(false); setEditingGrantId(null); setGrantError(""); }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password modal */}
      {showResetPassword && (
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
            onClick={() => { setShowResetPassword(false); setResetError(""); setResetSuccess(""); }}
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
              maxHeight: "90vh",
              overflowY: "auto",
              margin: "0 1rem",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, color: "#1F6B4D", fontSize: "1.1rem", fontWeight: 700 }}>
                Reset Password for {staff.name}
              </h3>
              <button
                onClick={() => { setShowResetPassword(false); setResetError(""); setResetSuccess(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.5rem", color: "#1F6B4D", lineHeight: 1, padding: "0.25rem" }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleResetPassword}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
              {resetError && <p className="form-error mb-1">{resetError}</p>}
              {resetSuccess && <p className="form-success mb-1">{resetSuccess}</p>}
              <div className="flex-row gap-sm">
                {!resetSuccess && (
                  <button type="submit" disabled={resetSaving} className="btn btn-success">
                    {resetSaving ? "Resetting..." : "Reset Password"}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => { setShowResetPassword(false); setResetError(""); setResetSuccess(""); }}
                >
                  {resetSuccess ? "Close" : "Cancel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete leave grant confirmation modal */}
      {deletingBalance && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 130,
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
            onClick={() => { setDeletingBalance(null); setBalanceDeleteError(""); }}
          />
          <div
            style={{
              position: "relative",
              background: "#FAF7F0",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.4)",
              boxShadow: "0 20px 40px rgba(31, 107, 77, 0.25)",
              borderTop: "4px solid #ba1a1a",
              maxWidth: 480,
              width: "calc(100% - 2rem)",
              margin: "0 1rem",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 style={{ margin: 0, color: "#ba1a1a", fontSize: "1.05rem", fontWeight: 700 }}>Remove Leave Grant</h3>
              <button
                onClick={() => { setDeletingBalance(null); setBalanceDeleteError(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.5rem", color: "#1F6B4D", lineHeight: 1, padding: "0.25rem" }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {deletingBalance.used > 0 ? (
              <p style={{ margin: "0 0 1rem", fontSize: "0.9rem", color: "var(--color-text)" }}>
                <strong>{deletingBalance.leaveTypeName}</strong> has already been used ({formatDays(deletingBalance.used)} days) and cannot be removed. Contact support if this was granted in error.
              </p>
            ) : (
              <p style={{ margin: "0 0 1rem", fontSize: "0.9rem", color: "var(--color-text)" }}>
                Remove <strong>{deletingBalance.leaveTypeName}</strong> ({formatDays(deletingBalance.granted)} days granted) from this staff member? This cannot be undone.
              </p>
            )}
            {balanceDeleteError && <p className="form-error mb-1">{balanceDeleteError}</p>}
            <div className="flex-row gap-sm">
              {deletingBalance.used === 0 ? (
                <button
                  onClick={confirmDeleteBalance}
                  disabled={balanceDeleting}
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
                  {balanceDeleting ? "Removing..." : "Confirm"}
                </button>
              ) : (
                <button
                  onClick={() => { setDeletingBalance(null); setBalanceDeleteError(""); }}
                  className="btn btn-ghost"
                >
                  Close
                </button>
              )}
              {deletingBalance.used === 0 && (
                <button
                  onClick={() => { setDeletingBalance(null); setBalanceDeleteError(""); }}
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
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function adisToday(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}
