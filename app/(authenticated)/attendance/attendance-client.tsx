"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Card from "@/modules/core/components/card";
import StatusPill from "@/modules/core/components/status-pill";
import PersonRow from "@/modules/core/components/person-row";
import { formatDays, formatDaysLabel, formatAttendanceStatus, formatDate } from "@/lib/format";
import { haversineDistance } from "@/lib/geo";

interface TodayRecord {
  id: string;
  signInTime: string | null;
  requestedStatus: string;
  note: string | null;
  status: string;
  date: string;
  reviewedBy: { id: string; name: string } | null;
}

interface PendingRecord {
  id: string;
  date: string;
  signInTime: string | null;
  requestedStatus: string;
  leaveTypeId: string | null;
  batchId: string | null;
  note: string | null;
  attachmentUrl: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    department: string | null;
    jobTitleName: string | null;
  };
}

interface Balance {
  leaveTypeId: string;
  leaveTypeName: string;
  isAnnualRecurring: boolean;
  granted: number;
  used: number;
  remaining: number;
}

interface LeaveType {
  id: string;
  name: string;
  mappedStatus: string;
  requiresAttachment: boolean;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  department: string | null;
  jobTitleName: string | null;
}

interface DailyRecord {
  date: string;
  status: string;
  note: string | null;
}

interface SummaryRow {
  userName: string;
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  pendingCount: number;
  records: DailyRecord[];
}

interface Props {
  userRole: string;
  currentUserId: string;
  todayRecord: TodayRecord | null;
  cutoffTime: string;
  initialOfficeLatitude: number | null;
  initialOfficeLongitude: number | null;
  initialAllowedRadiusMeters: number;
  isWeekend: boolean;
  initialSecondsUntil: number;
  initialSecondsUntilTomorrow: number;
  ongoingLeaveUntil: string | null;
  leaveTypes: LeaveType[];
  pendingRecords: PendingRecord[];
  balances: Record<string, Balance[]>;
  ownBalances: Balance[];
  myPendingRecords: MyPendingRecord[];
}

interface MyPendingRecord {
  id: string;
  date: string;
  requestedStatus: string;
  leaveTypeId: string | null;
  batchId: string | null;
  note: string | null;
  status: string;
}

function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getStatusVariant(status: string): "present" | "absent" | "pending" | "leave" {
  const s = status.toLowerCase();
  if (s === "present" || s === "approved" || s === "field_work") return "present";
  if (s === "absent" || s === "rejected") return "absent";
  if (s === "pending") return "pending";
  return "leave";
}

const isManager = (role: string) => role === "MANAGER";

function getCurrentMonthDefault(): { month: number; year: number } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
  });
  const [year, month] = formatter.format(now).split("-").map(Number);
  return { month, year };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function AttendanceClient({
  userRole,
  currentUserId,
  todayRecord,
  cutoffTime,
  initialOfficeLatitude,
  initialOfficeLongitude,
  initialAllowedRadiusMeters,
  isWeekend,
  initialSecondsUntil,
  initialSecondsUntilTomorrow,
  ongoingLeaveUntil,
  leaveTypes,
  pendingRecords,
  balances,
  ownBalances,
  myPendingRecords,
}: Props) {
  const router = useRouter();
  const [record, setRecord] = useState<TodayRecord | null>(todayRecord);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveType, setLeaveType] = useState(leaveTypes[0]?.mappedStatus ?? "PERMISSION");
  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.id ?? "");
  const [leaveNote, setLeaveNote] = useState("");
  const [leaveStartDate, setLeaveStartDate] = useState("");
  const [leaveEndDate, setLeaveEndDate] = useState("");
  const [leaveFile, setLeaveFile] = useState<File | null>(null);
  const [showFieldWorkForm, setShowFieldWorkForm] = useState(false);
  const [fieldWorkStartDate, setFieldWorkStartDate] = useState("");
  const [fieldWorkEndDate, setFieldWorkEndDate] = useState("");
  const [fieldWorkNote, setFieldWorkNote] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(initialSecondsUntil);
  const [secondsUntilTomorrow, setSecondsUntilTomorrow] = useState(initialSecondsUntilTomorrow);
  const locationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "checking" | "in-range" | "out-of-range" | "unavailable">("idle");

  const [pending, setPending] = useState<PendingRecord[]>(pendingRecords);
  const [approveLoadingId, setApproveLoadingId] = useState<string | null>(null);
  const [approveError, setApproveError] = useState("");

  const [cutoff, setCutoff] = useState(cutoffTime);

  // Sync client state when server props change after router.refresh()
  useEffect(() => { setRecord(todayRecord); }, [todayRecord]);
  useEffect(() => { setPending(pendingRecords); }, [pendingRecords]);

  // Periodically re-check the cutoff so countdowns stay accurate
  useEffect(() => {
    let cancelled = false;
    async function refreshCutoff() {
      try {
        const res = await fetch("/api/attendance/cutoff");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setCutoff(data.cutoffTime);
          setSecondsLeft(data.secondsUntilCutoff);
          const serverNow = Math.floor(new Date(data.serverTime).getTime() / 1000);
          const clientNow = Math.floor(Date.now() / 1000);
          const drift = clientNow - serverNow;
          setSecondsLeft((prev) => Math.max(0, prev - drift));
        }
      } catch { /* ignore */ }
    }
    const interval = setInterval(refreshCutoff, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const [officeLat, setOfficeLat] = useState(initialOfficeLatitude != null ? String(initialOfficeLatitude) : "");
  const [officeLng, setOfficeLng] = useState(initialOfficeLongitude != null ? String(initialOfficeLongitude) : "");
  const [radiusM, setRadiusM] = useState(String(initialAllowedRadiusMeters));
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);

  const defaultMonth = getCurrentMonthDefault();
  const [reportMonth, setReportMonth] = useState(defaultMonth.month);
  const [reportYear, setReportYear] = useState(defaultMonth.year);
  const [reportStaffId, setReportStaffId] = useState("");
  const [reportSummary, setReportSummary] = useState<SummaryRow[]>([]);
  const [reportStaff, setReportStaff] = useState<StaffMember[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportLoaded, setReportLoaded] = useState(false);
  const [reportError, setReportError] = useState("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const cutoffPassed = secondsLeft <= 0;

  const selectedLeaveType = leaveTypes.find((lt) => lt.id === leaveTypeId) ?? leaveTypes[0];

  const totalOwnRemaining = ownBalances.reduce((sum, b) => sum + b.remaining, 0);
  const maxOwnGranted = Math.max(ownBalances.reduce((sum, b) => sum + b.granted, 0), totalOwnRemaining);

  useEffect(() => {
    if (record || secondsLeft <= 0) {
      if (secondsUntilTomorrow <= 0) return;
      const interval = setInterval(() => {
        setSecondsUntilTomorrow((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
    if (secondsLeft <= 0) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [record, secondsLeft]);

  useEffect(() => {
    if (record || cutoffPassed || isWeekend) return;
    const hasOfficeCoords = initialOfficeLatitude != null && initialOfficeLongitude != null;
    if (!hasOfficeCoords) {
      setLocationStatus("unavailable");
      return;
    }
    if (!navigator.geolocation) {
      setLocationStatus("unavailable");
      return;
    }

    setLocationStatus("checking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = haversineDistance(
          pos.coords.latitude,
          pos.coords.longitude,
          initialOfficeLatitude!,
          initialOfficeLongitude!
        );
        locationRef.current = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setLocationStatus(dist <= initialAllowedRadiusMeters ? "in-range" : "out-of-range");
      },
      () => {
        setLocationStatus("unavailable");
      },
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
    );
  }, [record, cutoffPassed, isWeekend, initialOfficeLatitude, initialOfficeLongitude, initialAllowedRadiusMeters]);

  async function handleSignIn() {
    setLoading(true);
    setError("");
    setShowLeaveForm(false);

    let latitude: number | undefined;
    let longitude: number | undefined;

    const hasOfficeCoords = initialOfficeLatitude != null && initialOfficeLongitude != null;

    if (hasOfficeCoords) {
      if (locationRef.current) {
        latitude = locationRef.current.latitude;
        longitude = locationRef.current.longitude;
      } else {
        if (navigator.geolocation) {
          try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true });
            });
            latitude = pos.coords.latitude;
            longitude = pos.coords.longitude;
          } catch {
            setError("You must be at the office to sign in. Contact your manager if this is incorrect.");
            setLoading(false);
            return;
          }
        } else {
          setError("You must be at the office to sign in. Contact your manager if this is incorrect.");
          setLoading(false);
          return;
        }
      }
    }

    const res = await fetch("/api/attendance/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "signin", latitude, longitude }),
    });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 409 && data.record) {
        setRecord(data.record);
        setError("Already recorded today.");
      } else {
        setError(data.error || "Something went wrong.");
      }
    } else {
      setRecord(data.record);
    }
    setLoading(false);
    router.refresh();
  }

  async function handleLeaveRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!leaveFile) {
      setError("A signed attachment is required.");
      setLoading(false);
      return;
    }

    const isMultiDay = leaveStartDate && leaveEndDate && leaveStartDate !== leaveEndDate && leaveTypeId;

    const matchingBalance = ownBalances.find((b) => b.leaveTypeId === leaveTypeId);
    if (matchingBalance && matchingBalance.remaining <= 0) {
      setError("You have no remaining balance for this leave type.");
      setLoading(false);
      return;
    }

    const useFormData = leaveFile !== null;

    let res;
    if (useFormData) {
      const formData = new FormData();
      formData.append("action", "leave");
      formData.append("requestedStatus", leaveType);
      formData.append("leaveTypeId", leaveTypeId);
      if (isMultiDay) {
        formData.append("startDate", leaveStartDate);
        formData.append("endDate", leaveEndDate);
      }
      if (leaveNote) formData.append("note", leaveNote);
      formData.append("file", leaveFile!);
      res = await fetch("/api/attendance/sign-in", {
        method: "POST",
        body: formData,
      });
    } else {
      res = await fetch("/api/attendance/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "leave",
          requestedStatus: leaveType,
          leaveTypeId: leaveTypeId,
          startDate: isMultiDay ? leaveStartDate : undefined,
          endDate: isMultiDay ? leaveEndDate : undefined,
          note: leaveNote || undefined,
        }),
      });
    }
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 409 && data.record) {
        setRecord(data.record);
        setError("Already recorded today.");
      } else {
        setError(data.error || "Something went wrong.");
      }
    } else {
      setLeaveFile(null);
      setSuccess("Leave request submitted, awaiting approval.");
      if (data.multiDayBatch) {
        setShowLeaveForm(false);
        setLeaveStartDate("");
        setLeaveEndDate("");
        setRecord(null);
        router.refresh();
        setLoading(false);
        return;
      }
      setRecord(data.record);
    }
    setLoading(false);
    router.refresh();
  }

  async function handleFieldWorkRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const startDate = fieldWorkStartDate || new Date().toISOString().slice(0, 10);
      const endDate = fieldWorkEndDate || startDate;

      const res = await fetch("/api/attendance/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fieldwork",
          startDate,
          endDate,
          note: fieldWorkNote || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.record) {
          setRecord(data.record);
          setError("Already recorded today.");
        } else {
          setError(data.error || "Something went wrong.");
        }
      } else {
        setFieldWorkNote("");
        setFieldWorkStartDate("");
        setFieldWorkEndDate("");
        setShowFieldWorkForm(false);
        setSuccess("Field work submitted, awaiting approval.");
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveAction(recordId: string, action: "approve" | "reject") {
    setApproveLoadingId(recordId);
    setApproveError("");
    const res = await fetch("/api/attendance/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordId, action }),
    });
    if (res.ok) {
      const target = pending.find((r) => r.id === recordId);
      if (target?.batchId) {
        setPending((prev) => prev.filter((r) => r.batchId !== target.batchId));
      } else {
        setPending((prev) => prev.filter((r) => r.id !== recordId));
      }
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setApproveError(data.error || "Failed to " + action + ".");
    }
    setApproveLoadingId(null);
  }

  async function handleSettingsSave(e: React.FormEvent) {
    e.preventDefault();
    setSettingsError("");
    setSettingsSuccess("");
    setSettingsLoading(true);

    const body: Record<string, unknown> = { cutoffTime: cutoff };
    if (officeLat) body.officeLatitude = parseFloat(officeLat);
    if (officeLng) body.officeLongitude = parseFloat(officeLng);
    if (radiusM) body.allowedRadiusMeters = parseInt(radiusM, 10);

    const res = await fetch("/api/attendance/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      setSettingsError(data.error || "Failed to update.");
    } else {
      setCutoff(data.cutoffTime);
      if (data.officeLatitude !== undefined) setOfficeLat(String(data.officeLatitude));
      if (data.officeLongitude !== undefined) setOfficeLng(String(data.officeLongitude));
      if (data.allowedRadiusMeters !== undefined) setRadiusM(String(data.allowedRadiusMeters));
      setSettingsSuccess("Settings updated.");
      router.refresh();
    }
    setSettingsLoading(false);
  }

  function getLeaveTypeName(leaveTypeId: string | null): string | null {
    if (!leaveTypeId) return null;
    return leaveTypes.find((t) => t.id === leaveTypeId)?.name ?? null;
  }

  function getBalanceWarning(r: PendingRecord): string | null {
    if (!r.leaveTypeId) return null;
    const userBalances = balances[r.user.id];
    if (!userBalances) return null;
    const matching = userBalances.find((b) => b.leaveTypeId === r.leaveTypeId);
    if (!matching) return null;
    if (matching.remaining <= 0) {
      return `Balance would be negative (remaining: ${formatDaysLabel(matching.remaining)})`;
    }
    return null;
  }

  interface BatchGroup {
    firstId: string;
    batchId: string | null;
    user: { id: string; name: string; email: string; department: string | null; jobTitleName: string | null };
    requestedStatus: string;
    leaveTypeId: string | null;
    note: string | null;
    dateRange: string;
    count: number;
    records: PendingRecord[];
  }

  function groupPendingIntoBatches(records: PendingRecord[]): BatchGroup[] {
    const groups = new Map<string | null, PendingRecord[]>();
    for (const r of records) {
      const key = r.batchId || r.id;
      const existing = groups.get(key);
      if (existing) {
        existing.push(r);
      } else {
        groups.set(key, [r]);
      }
    }

    const result: BatchGroup[] = [];
    for (const [key, recs] of groups) {
      recs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const first = recs[0];
      const last = recs[recs.length - 1];
      const dateRange = recs.length > 1
        ? `${formatDate(first.date)} - ${formatDate(last.date)}`
        : formatDate(first.date);

      result.push({
        firstId: first.id,
        batchId: first.batchId,
        user: first.user,
        requestedStatus: first.requestedStatus,
        leaveTypeId: first.leaveTypeId,
        note: first.note,
        dateRange,
        count: recs.length,
        records: recs,
      });
    }
    return result;
  }

  const batchGroups = groupPendingIntoBatches(pending);

  function handleRowClick(userName: string) {
    if (expandedUser === userName) {
      setExpandedUser(null);
    } else {
      setExpandedUser(userName);
      setFilterStartDate("");
      setFilterEndDate("");
    }
  }

  const fetchReport = useCallback(async () => {
    setReportLoading(true);
    setReportError("");
    setReportStaffId("");

    const params = new URLSearchParams();
    params.set("month", String(reportMonth));
    params.set("year", String(reportYear));

    const res = await fetch(`/api/reports/monthly?${params.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      setReportError(data.error || "Failed to load report.");
      setReportLoading(false);
      return;
    }

    setReportSummary(data.summary);
    setReportStaff(data.staff);
    setReportLoaded(true);
    setReportLoading(false);
    setReportModalOpen(true);
  }, [reportMonth, reportYear]);

  const staffMap: Record<string, string> = {};
  for (const s of reportStaff) {
    staffMap[s.id] = s.name;
  }

  const filteredSummary = reportStaffId
    ? reportSummary.filter((s) => s.userName === staffMap[reportStaffId])
    : reportSummary;

  const xlsxUrl = `/api/reports/monthly?month=${reportMonth}&year=${reportYear}&format=xlsx${reportStaffId ? `&userId=${reportStaffId}` : ""}`;

  function renderAttendance() {
    if (isWeekend) {
      return (
        <div style={{
          background: "linear-gradient(135deg, #1F6B4D 0%, #18573d 100%)",
          borderRadius: "12px",
          padding: "1.5rem",
          color: "#fff",
          marginBottom: "1rem",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 20px 40px rgba(31,107,77,0.4)",
        }}>
          <div style={{ position: "absolute", top: 0, right: 0, width: "16rem", height: "16rem", background: "rgba(255,255,255,0.05)", borderRadius: "50%", filter: "blur(48px)", transform: "translate(5rem, -5rem)", pointerEvents: "none" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 1 }}>
            <div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#D9A441", display: "block", marginBottom: "0.5rem" }}>
                TODAY&apos;S ATTENDANCE
              </span>
              <p style={{ fontSize: "0.85rem", opacity: 0.7, margin: 0 }}>
                It&apos;s the weekend — no attendance needed today.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (record) {
      const recordStatus = getStatusVariant(record.status);

      const heroDoneStyle: React.CSSProperties = {
        background: "linear-gradient(135deg, #1F6B4D 0%, #18573d 100%)",
        borderRadius: "12px",
        padding: "1.5rem 1.5rem 1.25rem",
        color: "#fff",
        marginBottom: "1rem",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 20px 40px rgba(31,107,77,0.4)",
      };

      return (
        <div style={heroDoneStyle}>
          <div style={{ position: "absolute", top: 0, right: 0, width: "16rem", height: "16rem", background: "rgba(255,255,255,0.05)", borderRadius: "50%", filter: "blur(48px)", transform: "translate(5rem, -5rem)", pointerEvents: "none" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", position: "relative", zIndex: 1 }}>
            <div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#D9A441", display: "block", marginBottom: "0.5rem" }}>
                TODAY&apos;S ATTENDANCE
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <span style={{ background: "#D9A441", color: "#0A261B", padding: "0.15rem 0.75rem", borderRadius: "999px", fontSize: "0.8rem", fontWeight: 800, letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
                  {formatAttendanceStatus(record.status)}
                </span>
                {record.signInTime && (
                  <span style={{ fontSize: "0.9rem", fontWeight: 700, opacity: 0.9 }}>
                    Sign-in: {new Date(record.signInTime).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
            <span className="material-symbols-outlined" style={{ fontSize: "2.5rem", color: "#D9A441", textShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>how_to_reg</span>
          </div>

          <div style={{ marginTop: "1rem", padding: "0.75rem 1.25rem", background: "rgba(255,255,255,0.08)", borderRadius: "6px", borderTop: "1px solid rgba(255,255,255,0.2)", position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.65, fontWeight: 700 }}>Requested vs Status</p>
              <p style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#fff" }}>
                {record.requestedStatus === record.status ? "Matched" : formatAttendanceStatus(record.requestedStatus)}
              </p>
            </div>
            <div>
              {ongoingLeaveUntil ? (
                <>
                  <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.65, fontWeight: 700 }}>On leave until</p>
                  <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600, color: "#D9A441", fontFamily: "var(--font-mono)" }}>
                    {formatDate(ongoingLeaveUntil)}
                  </p>
                </>
              ) : secondsUntilTomorrow > 0 ? (
                <>
                  <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.65, fontWeight: 700 }}>Next Window Ends In</p>
                  <p style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#D9A441", fontFamily: "var(--font-mono)" }}>
                    {formatCountdown(secondsUntilTomorrow)}
                  </p>
                </>
              ) : null}
            </div>
          </div>
        </div>
      );
    }

    const heroStyle: React.CSSProperties = {
      background: "linear-gradient(135deg, #1F6B4D 0%, #18573d 100%)",
      borderRadius: "12px",
      padding: "1.5rem 1.5rem 1.25rem",
      color: "#fff",
      marginBottom: "1rem",
      position: "relative",
      overflow: "hidden",
      boxShadow: "0 20px 40px rgba(31,107,77,0.4)",
    };

    return (
      <div style={heroStyle}>
        <div style={{ position: "absolute", top: 0, right: 0, width: "16rem", height: "16rem", background: "rgba(255,255,255,0.05)", borderRadius: "50%", filter: "blur(48px)", transform: "translate(5rem, -5rem)", pointerEvents: "none" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", position: "relative", zIndex: 1 }}>
          <div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#D9A441", display: "block", marginBottom: "0.25rem" }}>
              TODAY&apos;S ATTENDANCE
            </span>
            <p style={{ fontSize: "0.85rem", opacity: 0.7, margin: "0 0 0.25rem" }}>You haven&apos;t signed in yet today.</p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.5rem" }}>
              <span style={{
                display: "inline-block",
                padding: "0.15rem 0.5rem",
                borderRadius: 999,
                fontSize: "0.7rem",
                fontWeight: 600,
                background: "rgba(255,255,255,0.15)",
              }}>
                Not Signed In
              </span>
            </div>
          </div>
          {!cutoffPassed && (
            <button
              onClick={handleSignIn}
              disabled={loading || locationStatus === "checking" || locationStatus === "idle" || locationStatus === "out-of-range"}
              style={{
                background: "#D9A441",
                color: "#0A261B",
                border: "none",
                borderRadius: "0.75rem",
                padding: "0.75rem 1.75rem",
                fontSize: "0.9rem",
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                boxShadow: "0 4px 15px rgba(217,164,65,0.4)",
              }}
            >
              {loading ? "Signing in..." : "Sign In Now"}
            </button>
          )}
        </div>

        {!cutoffPassed && (
          <div style={{ marginTop: "1rem", padding: "0.75rem 1.25rem", background: "rgba(255,255,255,0.08)", borderRadius: "6px", borderTop: "1px solid rgba(255,255,255,0.2)", position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "1.5rem", flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: 0, fontSize: "0.7rem", fontWeight: 600, opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}>Sign-in Closes In</p>
                <p style={{ margin: "0.2rem 0 0", fontSize: "2.25rem", fontWeight: 800, fontFamily: "var(--font-mono)", letterSpacing: "0.02em", lineHeight: 1, color: "#D9A441" }}>
                  {formatCountdown(secondsLeft)}
                </p>
              </div>
              {locationStatus === "checking" && (
                <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.7 }}>Checking location…</p>
              )}
              {locationStatus === "out-of-range" && (
                <p style={{ margin: 0, fontSize: "0.8rem", color: "#fca5a5", fontWeight: 500 }}>
                  You must be at the office to sign in.
                </p>
              )}
              {locationStatus === "in-range" && (
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6ee7b7" }}>✓ In range</span>
              )}
            </div>
          </div>
        )}

        {cutoffPassed && (
          <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "rgba(255,255,255,0.08)", borderRadius: "6px", borderTop: "1px solid rgba(255,255,255,0.2)", position: "relative", zIndex: 1 }}>
            <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600, color: "#fca5a5" }}>
              Sign-in closed for today (cutoff was {cutoffTime}).
            </p>
            {ongoingLeaveUntil ? (
              <p style={{ margin: "0.4rem 0 0", fontSize: "0.85rem", opacity: 0.6 }}>
                You&apos;re on leave until {formatDate(ongoingLeaveUntil)}.
              </p>
            ) : secondsUntilTomorrow > 0 ? (
              <p style={{ margin: "0.4rem 0 0", fontSize: "0.85rem", opacity: 0.7 }}>
                Next window closes in {formatCountdown(secondsUntilTomorrow)}
              </p>
            ) : null}
          </div>
        )}

        {error && <p style={{ marginTop: "1rem", color: "#fca5a5", fontWeight: 500, position: "relative", zIndex: 1 }}>{error}</p>}
      </div>
    );
  }

  function groupMyPendingBatches(records: MyPendingRecord[]): MyBatchGroup[] {
    const groups = new Map<string | null, MyPendingRecord[]>();
    for (const r of records) {
      const key = r.batchId || r.id;
      const existing = groups.get(key);
      if (existing) {
        existing.push(r);
      } else {
        groups.set(key, [r]);
      }
    }

    const result: MyBatchGroup[] = [];
    for (const [key, recs] of groups) {
      recs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const first = recs[0];
      const last = recs[recs.length - 1];
      const dateRange = recs.length > 1
        ? `${formatDate(first.date)} \u2013 ${formatDate(last.date)}`
        : formatDate(first.date);

      result.push({
        firstId: first.id,
        batchId: first.batchId,
        requestedStatus: first.requestedStatus,
        leaveTypeId: first.leaveTypeId,
        note: first.note,
        dateRange,
        count: recs.length,
      });
    }
    return result;
  }

  interface MyBatchGroup {
    firstId: string;
    batchId: string | null;
    requestedStatus: string;
    leaveTypeId: string | null;
    note: string | null;
    dateRange: string;
    count: number;
  }

  function renderMyPendingRequests() {
    if (myPendingRecords.length === 0) return null;
    const groups = groupMyPendingBatches(myPendingRecords);
    return (
      <Card style={{ marginTop: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <h2 style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--color-accent)", margin: 0 }}>
            My Pending Requests
          </h2>
        </div>
        <div className="table-responsive">
        <table className="table-card" style={{ boxShadow: "none", border: "none", borderRadius: 0 }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Note</th>
              <th style={{ textAlign: "center" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const displayStatus = g.requestedStatus === "FIELD_WORK"
                ? "Field Work"
                : g.leaveTypeId
                  ? leaveTypes.find((lt) => lt.id === g.leaveTypeId)?.name ?? formatAttendanceStatus(g.requestedStatus)
                  : formatAttendanceStatus(g.requestedStatus);
              const label = g.count > 1
                ? `${displayStatus} (${g.count} days)`
                : displayStatus;
              return (
              <tr key={g.firstId}>
                <td data-label="Date">{g.dateRange}</td>
                <td data-label="Type">{label}</td>
                <td data-label="Note" className="text-muted">{g.note || "\u2014"}</td>
                <td data-label="Status" style={{ textAlign: "center" }}>
                  <StatusPill status="pending" label="PENDING" />
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </Card>
    );
  }

  if (!isManager(userRole)) {
    return (
      <div className="page-container" style={{ maxWidth: 520 }}>
        <h1 className="page-title">Attendance</h1>
        {renderAttendance()}

        <div className="glass-card" style={{ borderRadius: "12px", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
          <button
            onClick={() => { setShowLeaveForm(!showLeaveForm); setShowFieldWorkForm(false); }}
            disabled={loading}
            className={showLeaveForm ? "btn btn-ghost" : "btn btn-primary"}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.65rem", borderRadius: "0.75rem", fontWeight: 800 }}
          >
            <span className="material-symbols-outlined" style={{ color: "#D9A441", fontSize: "1.2rem" }}>event_note</span>
            Request leave
          </button>
          <button
            onClick={() => { setShowFieldWorkForm(!showFieldWorkForm); setShowLeaveForm(false); }}
            disabled={loading}
            className={showFieldWorkForm ? "btn btn-ghost" : "btn btn-secondary"}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.65rem", borderRadius: "0.75rem", fontWeight: 800 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>explore</span>
            Field Work
          </button>
        </div>

        {showLeaveForm && (
          <Card style={{ marginBottom: "1rem", padding: "1rem", border: "1px solid var(--color-border)" }}>
            <form onSubmit={handleLeaveRequest}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label className="form-label">Leave type</label>
                <select
                  value={leaveTypeId}
                  onChange={(e) => {
                    const selected = leaveTypes.find((lt) => lt.id === e.target.value);
                    if (selected) {
                      setLeaveTypeId(selected.id);
                      setLeaveType(selected.mappedStatus);
                    }
                  }}
                  className="form-select"
                >
                  {leaveTypes.map((lt) => (
                    <option key={lt.id} value={lt.id}>
                      {lt.name}
                    </option>
                  ))}
                </select>
              </div>
              {ownBalances.find((b) => b.leaveTypeId === leaveTypeId && b.remaining <= 0) && (
                <p className="form-error mb-2" style={{ fontSize: "0.8rem" }}>
                  You have no remaining balance for this leave type.
                </p>
              )}
              <div className="flex-row gap-md mb-2 flex-wrap">
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label className="form-label">Start date</label>
                  <input type="date" className="form-input" value={leaveStartDate} onChange={(e) => setLeaveStartDate(e.target.value)} />
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label className="form-label">End date</label>
                  <input type="date" className="form-input" value={leaveEndDate} onChange={(e) => setLeaveEndDate(e.target.value)} />
                </div>
              </div>
              <p className="form-hint mb-2">Leave the dates empty to request a single day. Multi-day requests skip weekends.</p>
              <div style={{ marginBottom: "0.75rem" }}>
                <label className="form-label">Note (optional)</label>
                <input type="text" className="form-input" value={leaveNote} onChange={(e) => setLeaveNote(e.target.value)} placeholder="Reason for leave..." />
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label className="form-label">Signed attachment (required)</label>
                <input type="file" accept="image/*,.pdf" onChange={(e) => setLeaveFile(e.target.files?.[0] || null)} className="form-input" />
                {leaveFile && <p className="form-hint">{leaveFile.name}</p>}
              </div>
              <button type="submit" disabled={loading || !leaveFile} className="btn btn-primary">
                {loading ? "Submitting..." : "Submit request"}
              </button>
            </form>
          </Card>
        )}

        {showFieldWorkForm && (
          <Card style={{ marginBottom: "1rem", padding: "1rem", border: "1px solid var(--color-border)" }}>
            <h3 style={{ fontSize: "0.9rem", fontWeight: 600, margin: "0 0 0.75rem", color: "var(--color-brand)" }}>Field Work Request</h3>
            <form onSubmit={handleFieldWorkRequest}>
              <div className="flex-row gap-md mb-2 flex-wrap">
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label className="form-label">Start date</label>
                  <input type="date" className="form-input" value={fieldWorkStartDate} onChange={(e) => setFieldWorkStartDate(e.target.value)} />
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label className="form-label">End date</label>
                  <input type="date" className="form-input" value={fieldWorkEndDate} onChange={(e) => setFieldWorkEndDate(e.target.value)} />
                </div>
              </div>
              <p className="form-hint mb-2">Defaults to today if left empty. Multi-day requests skip weekends.</p>
              <div style={{ marginBottom: "0.75rem" }}>
                <label className="form-label">Where / Why</label>
                <input type="text" className="form-input" value={fieldWorkNote} onChange={(e) => setFieldWorkNote(e.target.value)} placeholder="e.g. Client visit at Bole..." />
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary">
                {loading ? "Submitting..." : "Submit field work"}
              </button>
            </form>
          </Card>
        )}

        {error && <p className="form-error mt-2">{error}</p>}
        {success && <p className="form-success mt-2">{success}</p>}

        {renderMyPendingRequests()}
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1 className="page-title">Operations</h1>

      <div className="card-grid" style={{ gap: "1rem", marginBottom: "1rem" }}>
        {/* Left column */}
        <div>
          {renderAttendance()}
          {renderMyPendingRequests()}

          {/* Admin Settings */}
          <div className="glass-card" style={{ borderRadius: "12px", padding: "1.5rem", marginTop: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "1.25rem", color: "#D9A441" }}>settings</span>
              <span className="section-label" style={{ color: "#1F6B4D" }}>ADMIN SETTINGS</span>
            </div>
            <form onSubmit={handleSettingsSave}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1F6B4D" }}>Cutoff Time</label>
                  <input
                    id="cutoffTime"
                    type="text"
                    className="form-input"
                    value={cutoff}
                    onChange={(e) => setCutoff(e.target.value)}
                    placeholder="09:00"
                    style={{ textAlign: "center", fontSize: "0.85rem", fontWeight: 600 }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1F6B4D" }}>Office Location</label>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      value={officeLat}
                      onChange={(e) => setOfficeLat(e.target.value)}
                      placeholder="Lat"
                      style={{ fontSize: "0.8rem" }}
                    />
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      value={officeLng}
                      onChange={(e) => setOfficeLng(e.target.value)}
                      placeholder="Lng"
                      style={{ fontSize: "0.8rem" }}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1F6B4D" }}>Allowed Radius (m)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={radiusM}
                    onChange={(e) => setRadiusM(e.target.value)}
                    style={{ textAlign: "center", fontSize: "0.85rem", fontWeight: 600 }}
                  />
                </div>
              </div>

              {settingsError && <p className="form-error mb-1" style={{ marginTop: "0.75rem" }}>{settingsError}</p>}
              {settingsSuccess && <p className="form-success mb-1" style={{ marginTop: "0.75rem" }}>{settingsSuccess}</p>}

              <button type="submit" disabled={settingsLoading} className="btn btn-primary" style={{ marginTop: "1rem" }}>
                {settingsLoading ? "Saving..." : "Save Settings"}
              </button>
            </form>
          </div>

          {/* Pending Approvals */}
          <div style={{ marginTop: "1rem" }}>
            <div className="glass-card" style={{ borderRadius: "12px", padding: batchGroups.length > 0 ? "0" : "2rem", overflow: "hidden" }}>
              {batchGroups.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "2.5rem", color: "#D9A441", marginBottom: "0.75rem" }}>inbox</span>
                  <p className="section-label" style={{ color: "#1F6B4D", opacity: 0.7, marginBottom: "0.25rem" }}>PENDING APPROVALS</p>
                  <p style={{ color: "#1F6B4D", opacity: 0.7, margin: 0, fontWeight: 700 }}>No pending records.</p>
                </div>
              ) : (
                <>
                  {approveError && <p className="form-error mb-1" style={{ padding: "1rem 1rem 0" }}>{approveError}</p>}
                  <div className="table-responsive">
                  <table className="table-card" style={{ boxShadow: "none", border: "none", borderRadius: 0 }}>
                    <thead>
                      <tr>
                        <th>Staff</th>
                        <th>Date</th>
                        <th>Requested</th>
                        <th>Note</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchGroups.map((g) => {
                        const firstRecord = g.records[0];
                        const warning = getBalanceWarning(firstRecord);
                        const displayStatus = firstRecord.requestedStatus === "FIELD_WORK"
                          ? "Field Work"
                          : g.leaveTypeId
                            ? getLeaveTypeName(g.leaveTypeId) ?? formatAttendanceStatus(g.requestedStatus)
                            : formatAttendanceStatus(g.requestedStatus);
                        const label = g.count > 1
                          ? `${displayStatus} (${g.count} days)`
                          : displayStatus;
                        const isLoading = approveLoadingId === g.firstId;
                        return (
                          <tr key={g.firstId}>
                            <td data-label="Staff">
                              <PersonRow
                                name={g.user.name}
                                jobTitleName={g.user.jobTitleName}
                                size="sm"
                              />
                            </td>
                            <td data-label="Date" style={{ whiteSpace: "nowrap" }}>{g.dateRange}</td>
                            <td data-label="Requested">
                              <StatusPill
                                status={g.requestedStatus.toLowerCase() === "present" ? "present" : "pending"}
                                label={label}
                              />
                            </td>
                            <td data-label="Note" className="text-muted">{g.note || "\u2014"}</td>
                            <td data-label="Actions" style={{ whiteSpace: "nowrap" }}>
                              {firstRecord.attachmentUrl && (
                                <div className="mb-1 flex-row gap-sm">
                                  <a
                                    href={`/api/attachments?url=${encodeURIComponent(firstRecord.attachmentUrl)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-ghost btn-sm"
                                  >
                                    View
                                  </a>
                                  <a
                                    href={`/api/attachments?url=${encodeURIComponent(firstRecord.attachmentUrl)}&download=1`}
                                    className="btn btn-ghost btn-sm"
                                  >
                                    Download
                                  </a>
                                </div>
                              )}
                              {warning && (
                                <div className="mb-1">
                                  <span className="status-pill status-pill--danger" style={{ fontSize: "0.7rem" }}>
                                    {warning}
                                  </span>
                                </div>
                              )}
                              <div className="flex-row gap-sm">
                                <button
                                  onClick={() => handleApproveAction(g.firstId, "approve")}
                                  disabled={isLoading}
                                  className="btn btn-success btn-sm"
                                >
                                  {isLoading ? "…" : "Approve"}
                                </button>
                                <button
                                  onClick={() => handleApproveAction(g.firstId, "reject")}
                                  disabled={isLoading}
                                  className="btn btn-danger btn-sm"
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Action buttons */}
          <div className="glass-card" style={{ borderRadius: "12px", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
            <button
              onClick={() => { setShowLeaveForm(!showLeaveForm); setShowFieldWorkForm(false); }}
              disabled={loading}
              className={showLeaveForm ? "btn btn-ghost" : "btn btn-primary"}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.75rem", borderRadius: "0.75rem", fontWeight: 800 }}
            >
              <span className="material-symbols-outlined" style={{ color: "#D9A441", fontSize: "1.2rem" }}>event_note</span>
              Request leave
            </button>
            <button
              onClick={() => { setShowFieldWorkForm(!showFieldWorkForm); setShowLeaveForm(false); }}
              disabled={loading}
              className={showFieldWorkForm ? "btn btn-ghost" : "btn btn-secondary"}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.75rem", borderRadius: "0.75rem", fontWeight: 800 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>explore</span>
              Field Work
            </button>
          </div>

          {showLeaveForm && (
            <Card
              style={{ marginTop: "0.75rem", padding: "1rem", border: "1px solid var(--color-border)" }}
            >
              <form onSubmit={handleLeaveRequest}>
                <div style={{ marginBottom: "0.75rem" }}>
                  <label className="form-label">Leave type</label>
                  <select
                    value={leaveTypeId}
                    onChange={(e) => {
                      const selected = leaveTypes.find((lt) => lt.id === e.target.value);
                      if (selected) {
                        setLeaveTypeId(selected.id);
                        setLeaveType(selected.mappedStatus);
                      }
                    }}
                    className="form-select"
                  >
                    {leaveTypes.map((lt) => (
                      <option key={lt.id} value={lt.id}>
                        {lt.name}
                      </option>
                    ))}
                  </select>
                </div>
                {ownBalances.find((b) => b.leaveTypeId === leaveTypeId && b.remaining <= 0) && (
                  <p className="form-error mb-2" style={{ fontSize: "0.8rem" }}>
                    You have no remaining balance for this leave type.
                  </p>
                )}
                <div className="flex-row gap-md mb-2 flex-wrap">
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label className="form-label">Start date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={leaveStartDate}
                      onChange={(e) => setLeaveStartDate(e.target.value)}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label className="form-label">End date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={leaveEndDate}
                      onChange={(e) => setLeaveEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <p className="form-hint mb-2">
                  Leave the dates empty to request a single day. Multi-day requests skip weekends.
                </p>
                <div style={{ marginBottom: "0.75rem" }}>
                  <label className="form-label">Note (optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={leaveNote}
                    onChange={(e) => setLeaveNote(e.target.value)}
                    placeholder="Reason for leave..."
                  />
                </div>

                <div style={{ marginBottom: "0.75rem" }}>
                  <label className="form-label">Signed attachment (required)</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setLeaveFile(e.target.files?.[0] || null)}
                    className="form-input"
                  />
                  {leaveFile && (
                    <p className="form-hint">{leaveFile.name}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !leaveFile}
                  className="btn btn-primary"
                >
                  {loading ? "Submitting..." : "Submit request"}
                </button>
              </form>
            </Card>
          )}

          {showFieldWorkForm && (
            <Card
              style={{ marginTop: "0.75rem", padding: "1rem", border: "1px solid var(--color-border)" }}
            >
              <h3 style={{ fontSize: "0.9rem", fontWeight: 600, margin: "0 0 0.75rem", color: "var(--color-brand)" }}>
                Field Work Request
              </h3>
              <form onSubmit={handleFieldWorkRequest}>
                <div className="flex-row gap-md mb-2 flex-wrap">
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label className="form-label">Start date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={fieldWorkStartDate}
                      onChange={(e) => setFieldWorkStartDate(e.target.value)}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label className="form-label">End date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={fieldWorkEndDate}
                      onChange={(e) => setFieldWorkEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <p className="form-hint mb-2">
                  Defaults to today if left empty. Multi-day requests skip weekends.
                </p>
                <div style={{ marginBottom: "0.75rem" }}>
                  <label className="form-label">Where / Why</label>
                  <input
                    type="text"
                    className="form-input"
                    value={fieldWorkNote}
                    onChange={(e) => setFieldWorkNote(e.target.value)}
                    placeholder="e.g. Client visit at Bole..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                >
                  {loading ? "Submitting..." : "Submit field work"}
                </button>
              </form>
            </Card>
          )}

          {error && <p className="form-error mt-2">{error}</p>}
          {success && <p className="form-success mt-2">{success}</p>}

          {/* Your Leave */}
          <div className="glass-card" style={{ borderRadius: "12px", padding: "1.25rem", marginBottom: "1rem" }}>
            <span className="section-label" style={{ color: "#1F6B4D", display: "block", marginBottom: "1rem" }}>YOUR LEAVE</span>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
              {/* Radial gauge with teal→amber gradient stroke, label inside the ring */}
              <div style={{ position: "relative", width: 160, height: 160, margin: "0 auto" }}>
                <svg width={160} height={160} style={{ display: "block", transform: "rotate(-90deg)" }}>
                  <defs>
                    <linearGradient id="leaveGaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#1F6B4D" />
                      <stop offset="100%" stopColor="#D9A441" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx={80}
                    cy={80}
                    r={73}
                    fill="none"
                    stroke="var(--color-border-light)"
                    strokeWidth={14}
                  />
                  {maxOwnGranted > 0 && (() => {
                    const ratio = Math.min(Math.max(totalOwnRemaining / maxOwnGranted, 0), 1);
                    const radius = 73;
                    const circumference = 2 * Math.PI * radius;
                    const dashOffset = circumference * (1 - ratio);
                    return (
                      <circle
                        cx={80}
                        cy={80}
                        r={radius}
                        fill="none"
                        stroke="url(#leaveGaugeGradient)"
                        strokeWidth={14}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset}
                        style={{ transition: "stroke-dashoffset 0.4s ease" }}
                      />
                    );
                  })()}
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "#1F6B4D", lineHeight: 1, fontFamily: "var(--font-sans)" }}>
                    {formatDays(totalOwnRemaining)}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#1F6B4D", opacity: 0.7, marginTop: "0.15rem" }}>
                    DAYS REMAINING
                  </span>
                </div>
              </div>

              {ownBalances.length > 0 && (
                <div style={{ width: "100%", marginTop: "0.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid rgba(31,107,77,0.1)" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1F6B4D", opacity: 0.8 }}>Total</span>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#1F6B4D" }}>{formatDays(maxOwnGranted)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid rgba(31,107,77,0.1)" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1F6B4D", opacity: 0.8 }}>Used</span>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#1F6B4D" }}>{formatDays(maxOwnGranted - totalOwnRemaining)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1F6B4D", opacity: 0.8 }}>Annual leave</span>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#1F6B4D" }}>{formatDays(ownBalances[0]?.granted ?? 0)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Monthly Report */}
          <div className="glass-card" style={{ borderRadius: "12px", padding: "1.25rem" }}>
            <span className="section-label" style={{ color: "#1F6B4D", display: "block", marginBottom: "1rem" }}>MONTHLY REPORT</span>
            <div className="flex-row gap-md flex-wrap">
              <div>
                <label className="form-label">Month</label>
                <select
                  value={reportMonth}
                  onChange={(e) => { setReportMonth(Number(e.target.value)); setReportLoaded(false); }}
                  className="form-select"
                  style={{ minWidth: 150 }}
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={i + 1} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Year</label>
                <select
                  value={reportYear}
                  onChange={(e) => { setReportYear(Number(e.target.value)); setReportLoaded(false); }}
                  className="form-select"
                  style={{ minWidth: 110 }}
                >
                  {Array.from({ length: 6 }, (_, i) => reportYear - 2 + i).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {reportLoaded && reportStaff.length > 0 && (
                <div>
                  <label className="form-label">Staff (optional)</label>
                  <select
                    value={reportStaffId}
                    onChange={(e) => setReportStaffId(e.target.value)}
                    className="form-select"
                    style={{ minWidth: 180 }}
                  >
                    <option value="">All staff</option>
                    {reportStaff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex-row gap-md mt-2">
              <button
                onClick={fetchReport}
                disabled={reportLoading}
                className="btn btn-primary"
              >
                {reportLoading ? "Loading..." : "View Report"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {reportModalOpen && (
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
            onClick={() => setReportModalOpen(false)}
          />
          <div
            style={{
              position: "relative",
              background: "#FAF7F0",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.4)",
              boxShadow: "0 20px 40px rgba(31, 107, 77, 0.25)",
              borderTop: "4px solid #D9A441",
              maxWidth: 960,
              width: "calc(100% - 2rem)",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              margin: "0 1rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem 0", flexShrink: 0 }}>
              <span className="section-label" style={{ color: "#1F6B4D" }}>MONTHLY ATTENDANCE REPORT</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <a href={xlsxUrl} className="btn btn-success btn-sm">
                  Download report
                </a>
                <button
                  onClick={() => setReportModalOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "1.5rem",
                    color: "#1F6B4D",
                    lineHeight: 1,
                    padding: "0.25rem",
                  }}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: "0 1.5rem 1.5rem" }}>
              {reportError && (
                <p className="form-error mb-2" style={{ marginTop: "1rem" }}>{reportError}</p>
              )}

              {reportLoaded && filteredSummary.length === 0 && !reportLoading && (
                <Card style={{ marginTop: "1rem" }}>
                  <p className="text-muted text-center" style={{ padding: "1rem 0", margin: 0 }}>
                    No attendance records for this month.
                  </p>
                </Card>
              )}

              {reportLoaded && filteredSummary.length > 0 && (
                <Card style={{ padding: 0, overflow: "hidden", marginTop: "1rem" }}>
                  <div className="table-responsive">
                  <table className="table-card" style={{ boxShadow: "none", border: "none", borderRadius: 0 }}>
                    <thead>
                      <tr>
                        <th>Staff</th>
                        <th style={{ textAlign: "center" }}>Present</th>
                        <th style={{ textAlign: "center" }}>Absent</th>
                        <th style={{ textAlign: "center" }}>Leave</th>
                        <th style={{ textAlign: "center" }}>Pending</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSummary.map((row) => {
                        const isExpanded = expandedUser === row.userName;
                        return (
                          <>
                            <tr
                              key={row.userName}
                              onClick={() => handleRowClick(row.userName)}
                              style={{ cursor: "pointer" }}
                            >
                              <td data-label="Staff" style={{ fontWeight: 600 }}>
                                {isExpanded ? "▼" : "▶"} {row.userName}
                              </td>
                              <td data-label="Present" style={{ textAlign: "center" }}>
                                {row.presentCount > 0 ? (
                                  <StatusPill status="present" label={String(row.presentCount)} />
                                ) : (
                                  row.presentCount
                                )}
                              </td>
                              <td data-label="Absent" style={{ textAlign: "center" }}>
                                {row.absentCount > 0 ? (
                                  <StatusPill status="absent" label={String(row.absentCount)} />
                                ) : (
                                  row.absentCount
                                )}
                              </td>
                              <td data-label="Leave" style={{ textAlign: "center" }}>
                                {row.leaveCount > 0 ? (
                                  <StatusPill status="leave" label={String(row.leaveCount)} />
                                ) : (
                                  row.leaveCount
                                )}
                              </td>
                              <td data-label="Pending" style={{ textAlign: "center" }}>
                                {row.pendingCount > 0 ? (
                                  <StatusPill status="pending" label={String(row.pendingCount)} />
                                ) : (
                                  row.pendingCount
                                )}
                              </td>
                            </tr>
                            {isExpanded && row.records.length > 0 && (() => {
                              const hasRange = !!(filterStartDate || filterEndDate);
                              const filteredRecords = hasRange
                                ? row.records.filter((r) => {
                                    const rd = r.date.slice(0, 10);
                                    if (filterStartDate && rd < filterStartDate) return false;
                                    if (filterEndDate && rd > filterEndDate) return false;
                                    return true;
                                  })
                                : row.records;
                              return (
                              <tr key={`${row.userName}-detail`}>
                                <td colSpan={5} style={{ padding: 0 }}>
                                  <div style={{ padding: "1rem 1.5rem 0.75rem", background: "var(--color-surface-hover)", borderTop: "2px solid var(--color-brand)", margin: "0 0.5rem" }}>
                                    <div className="flex-row gap-sm flex-wrap" style={{ alignItems: "flex-end" }}>
                                      <div>
                                        <label className="form-label" style={{ fontSize: "0.75rem" }}>Start date</label>
                                        <input
                                          type="date"
                                          className="form-input"
                                          value={filterStartDate}
                                          onChange={(e) => setFilterStartDate(e.target.value)}
                                          style={{ maxWidth: 155, fontSize: "0.8125rem" }}
                                        />
                                      </div>
                                      <div>
                                        <label className="form-label" style={{ fontSize: "0.75rem" }}>End date</label>
                                        <input
                                          type="date"
                                          className="form-input"
                                          value={filterEndDate}
                                          onChange={(e) => setFilterEndDate(e.target.value)}
                                          style={{ maxWidth: 155, fontSize: "0.8125rem" }}
                                        />
                                      </div>
                                      {hasRange && (
                                        <button
                                          type="button"
                                          className="btn btn-ghost btn-sm"
                                          onClick={() => { setFilterStartDate(""); setFilterEndDate(""); }}
                                        >
                                          Clear filter
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="detail-scroll" style={{ maxHeight: 260, overflowY: "auto", margin: "0 0.5rem" }}>
                                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead>
                                      <tr>
                                        <th style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem", textAlign: "left", fontWeight: 600, background: "var(--color-brand)", color: "#fff", textTransform: "uppercase", letterSpacing: "0.03em" }}>Date</th>
                                        <th style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem", textAlign: "left", fontWeight: 600, background: "var(--color-brand)", color: "#fff", textTransform: "uppercase", letterSpacing: "0.03em" }}>Status</th>
                                        <th style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem", textAlign: "left", fontWeight: 600, background: "var(--color-brand)", color: "#fff", textTransform: "uppercase", letterSpacing: "0.03em" }}>Note</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {filteredRecords.length === 0 ? (
                                        <tr>
                                          <td colSpan={3} style={{ padding: "0.75rem", textAlign: "center", color: "var(--color-text-muted)", fontSize: "0.8125rem" }}>
                                            No records in this range.
                                          </td>
                                        </tr>
                                      ) : (
                                        filteredRecords.map((r, i) => (
                                        <tr key={i}>
                                          <td data-label="Date" style={{ padding: "0.35rem 0.75rem", fontSize: "0.8125rem", borderBottom: "1px solid var(--color-border-light)" }}>{formatDate(r.date)}</td>
                                          <td data-label="Status" style={{ padding: "0.35rem 0.75rem", fontSize: "0.8125rem", borderBottom: "1px solid var(--color-border-light)" }}>
                                            <StatusPill
                                              status={
                                                r.status === "PRESENT" || r.status === "APPROVED" || r.status === "FIELD_WORK" ? "present" :
                                                r.status === "ABSENT" || r.status === "REJECTED" ? "absent" :
                                                r.status === "PENDING" ? "pending" : "leave"
                                              }
                                              label={formatAttendanceStatus(r.status)}
                                            />
                                          </td>
                                          <td data-label="Note" style={{ padding: "0.35rem 0.75rem", fontSize: "0.8125rem", borderBottom: "1px solid var(--color-border-light)", color: "var(--color-text-muted)" }}>{r.note || "\u2014"}</td>
                                        </tr>
                                        ))
                                      )}
                                    </tbody>
                                  </table>
                                  </div>
                                </td>
                              </tr>
                              );
                            })()}
                            {isExpanded && row.records.length === 0 && (
                              <tr key={`${row.userName}-empty`}>
                                <td colSpan={5} style={{ padding: "0.75rem 1.5rem", color: "var(--color-text-muted)", fontSize: "0.8125rem", background: "var(--color-bg)" }}>
                                  No daily records for this month.
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
