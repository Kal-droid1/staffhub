"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Card from "@/modules/core/components/card";
import StatusPill from "@/modules/core/components/status-pill";

interface Record {
  id: string;
  signInTime: string | null;
  requestedStatus: string;
  note: string | null;
  status: string;
  date: string;
  reviewedBy: { id: string; name: string } | null;
}

interface Props {
  todayRecord: Record | null;
  cutoffTime: string;
  initialSecondsUntil: number;
  leaveTypes: { id: string; name: string; mappedStatus: string }[];
}

function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getStatusVariant(status: string): "present" | "absent" | "pending" | "leave" {
  const s = status.toLowerCase();
  if (s === "present" || s === "approved") return "present";
  if (s === "absent" || s === "rejected") return "absent";
  if (s === "pending") return "pending";
  return "leave";
}

export default function AttendanceClient({ todayRecord, cutoffTime, initialSecondsUntil, leaveTypes }: Props) {
  const router = useRouter();
  const [record, setRecord] = useState<Record | null>(todayRecord);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveType, setLeaveType] = useState(leaveTypes[0]?.mappedStatus ?? "PERMISSION");
  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.id ?? "");
  const [leaveNote, setLeaveNote] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(initialSecondsUntil);

  const cutoffPassed = secondsLeft <= 0;

  useEffect(() => {
    if (record) return;
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

  async function handleSignIn() {
    setLoading(true);
    setError("");
    setShowLeaveForm(false);

    const res = await fetch("/api/attendance/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "signin" }),
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

    const res = await fetch("/api/attendance/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "leave",
        requestedStatus: leaveType,
        leaveTypeId: leaveTypeId,
        note: leaveNote || undefined,
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
      setRecord(data.record);
    }
    setLoading(false);
    router.refresh();
  }

  if (record) {
    const recordStatus = getStatusVariant(record.status);

    return (
      <div className="page-container" style={{ maxWidth: 520 }}>
        <h1 className="page-title">Attendance</h1>
        <Card>
          <p className="mb-2" style={{ fontWeight: 500 }}>
            You have already recorded your attendance for today.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <div className="flex-row">
              <span className="text-muted text-sm" style={{ minWidth: 110 }}>
                Date
              </span>
              <span style={{ fontWeight: 500 }}>
                {new Date(record.date).toLocaleDateString()}
              </span>
            </div>
            {record.signInTime && (
              <div className="flex-row">
                <span className="text-muted text-sm" style={{ minWidth: 110 }}>
                  Sign-in time
                </span>
                <span style={{ fontWeight: 500 }}>
                  {new Date(record.signInTime).toLocaleTimeString()}
                </span>
              </div>
            )}
            <div className="flex-row">
              <span className="text-muted text-sm" style={{ minWidth: 110 }}>
                Requested
              </span>
              <span style={{ fontWeight: 500 }}>{record.requestedStatus}</span>
            </div>
            {record.note && (
              <div className="flex-row">
                <span className="text-muted text-sm" style={{ minWidth: 110 }}>
                  Note
                </span>
                <span>{record.note}</span>
              </div>
            )}
            <div className="flex-row">
              <span className="text-muted text-sm" style={{ minWidth: 110 }}>
                Status
              </span>
              <StatusPill status={recordStatus} label={record.status} />
            </div>
            {record.reviewedBy && (
              <div className="flex-row">
                <span className="text-muted text-sm" style={{ minWidth: 110 }}>
                  Reviewed by
                </span>
                <span style={{ fontWeight: 500 }}>{record.reviewedBy.name}</span>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: 520 }}>
      <h1 className="page-title">Attendance</h1>
      <Card>
        <p className="mb-2" style={{ fontWeight: 500 }}>
          You haven&apos;t recorded your attendance today.
        </p>

        {!cutoffPassed && (
          <p className="mb-2" style={{ fontSize: "1.1rem", fontWeight: 500, color: "var(--color-accent)" }}>
            Sign-in closes in {formatCountdown(secondsLeft)}
          </p>
        )}

        {cutoffPassed && (
          <p className="mb-2 form-error" style={{ fontWeight: 500 }}>
            Sign-in closed for today (cutoff was {cutoffTime}). Use Request leave if needed.
          </p>
        )}

        <div className="flex-row gap-md mt-2">
          {!cutoffPassed && (
            <button
              onClick={handleSignIn}
              disabled={loading}
              className="btn btn-success"
            >
              {loading && !showLeaveForm ? "Signing in..." : "Sign in"}
            </button>
          )}

          <button
            onClick={() => setShowLeaveForm(!showLeaveForm)}
            disabled={loading}
            className={showLeaveForm ? "btn btn-ghost" : "btn btn-primary"}
          >
            Request leave
          </button>
        </div>

        {showLeaveForm && (
          <Card
            style={{ marginTop: "1rem", padding: "1.25rem", border: "1px solid var(--color-border)" }}
          >
            <form onSubmit={handleLeaveRequest}>
              <div style={{ marginBottom: "1rem" }}>
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
              <div style={{ marginBottom: "1rem" }}>
                <label className="form-label">Note (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={leaveNote}
                  onChange={(e) => setLeaveNote(e.target.value)}
                  placeholder="Reason for leave..."
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? "Submitting..." : "Submit request"}
              </button>
            </form>
          </Card>
        )}

        {error && <p className="form-error mt-2">{error}</p>}
      </Card>
    </div>
  );
}
