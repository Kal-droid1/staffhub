"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

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

export default function AttendanceClient({ todayRecord, cutoffTime, initialSecondsUntil, leaveTypes }: Props) {
  const router = useRouter();
  const [record, setRecord] = useState<Record | null>(todayRecord);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveType, setLeaveType] = useState(leaveTypes[0]?.mappedStatus ?? "PERMISSION");
  const [leaveNote, setLeaveNote] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(initialSecondsUntil);

  const cutoffPassed = secondsLeft <= 0;

  useEffect(() => {
    if (record) return; // already recorded, no countdown needed
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
    return (
      <div style={{ maxWidth: 500, margin: "40px auto", padding: "0 1rem" }}>
        <h1>Attendance</h1>
        <p>You have already recorded your attendance for today.</p>
        <ul style={{ listStyle: "none", padding: 0, lineHeight: 2 }}>
          <li>
            <strong>Date:</strong> {new Date(record.date).toLocaleDateString()}
          </li>
          {record.signInTime && (
            <li>
              <strong>Sign-in time:</strong>{" "}
              {new Date(record.signInTime).toLocaleTimeString()}
            </li>
          )}
          <li>
            <strong>Requested:</strong> {record.requestedStatus}
          </li>
          {record.note && (
            <li>
              <strong>Note:</strong> {record.note}
            </li>
          )}
          <li>
            <strong>Status:</strong> {record.status}
          </li>
          {record.reviewedBy && (
            <li>
              <strong>Reviewed by:</strong> {record.reviewedBy.name}
            </li>
          )}
        </ul>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 500, margin: "40px auto", padding: "0 1rem" }}>
      <h1>Attendance</h1>
      <p>You haven&apos;t recorded your attendance today.</p>

      {!cutoffPassed && (
        <p style={{ fontSize: "1.1rem", fontWeight: 500, color: "#2563eb" }}>
          Sign-in closes in {formatCountdown(secondsLeft)}
        </p>
      )}

      {cutoffPassed && (
        <p style={{ color: "#dc2626", fontWeight: 500 }}>
          Sign-in closed for today (cutoff was {cutoffTime}). Use Request leave if needed.
        </p>
      )}

      <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
        {!cutoffPassed && (
          <button
            onClick={handleSignIn}
            disabled={loading}
            style={{
              padding: "0.75rem 1.5rem",
              fontSize: "1rem",
              backgroundColor: "#16a34a",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
            }}
          >
            {loading && !showLeaveForm ? "Signing in..." : "Sign in"}
          </button>
        )}

        <button
          onClick={() => setShowLeaveForm(!showLeaveForm)}
          disabled={loading}
          style={{
            padding: "0.75rem 1.5rem",
            fontSize: "1rem",
            backgroundColor: showLeaveForm ? "#9ca3af" : "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "0.375rem",
            cursor: "pointer",
          }}
        >
          Request leave
        </button>
      </div>

      {showLeaveForm && (
        <form
          onSubmit={handleLeaveRequest}
          style={{ marginTop: "1rem", padding: "1rem", border: "1px solid #e5e7eb", borderRadius: "0.375rem" }}
        >
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 500 }}>
              Leave type
            </label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }}
            >
              {leaveTypes.map((lt) => (
                <option key={lt.id} value={lt.mappedStatus}>
                  {lt.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 500 }}>
              Note (optional)
            </label>
            <input
              type="text"
              value={leaveNote}
              onChange={(e) => setLeaveNote(e.target.value)}
              placeholder="Reason for leave..."
              style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "0.25rem",
              cursor: "pointer",
            }}
          >
            {loading ? "Submitting..." : "Submit request"}
          </button>
        </form>
      )}

      {error && <p style={{ color: "#dc2626", marginTop: "1rem" }}>{error}</p>}
    </div>
  );
}
