"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  todayRecord: {
    id: string;
    signInTime: string | null;
    status: string;
    date: string;
  } | null;
}

export default function AttendanceClient({ todayRecord }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [record, setRecord] = useState(todayRecord);

  async function handleSignIn() {
    setLoading(true);
    setError("");

    const res = await fetch("/api/attendance/sign-in", { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 409 && data.record) {
        setRecord({
          id: data.record.id,
          signInTime: data.record.signInTime,
          status: data.record.status,
          date: data.record.date,
        });
        setError("Already signed in today.");
      } else {
        setError(data.error || "Something went wrong.");
      }
    } else {
      setRecord({
        id: data.record.id,
        signInTime: data.record.signInTime,
        status: data.record.status,
        date: data.record.date,
      });
    }

    setLoading(false);
    router.refresh();
  }

  if (record) {
    return (
      <div style={{ maxWidth: 500, margin: "60px auto", padding: "0 1rem" }}>
        <h1>Attendance</h1>
        <p>You have already signed in today.</p>
        <ul style={{ listStyle: "none", padding: 0 }}>
          <li>
            <strong>Date:</strong>{" "}
            {new Date(record.date).toLocaleDateString()}
          </li>
          {record.signInTime && (
            <li>
              <strong>Sign-in time:</strong>{" "}
              {new Date(record.signInTime).toLocaleTimeString()}
            </li>
          )}
          <li>
            <strong>Status:</strong> {record.status}
          </li>
        </ul>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 500, margin: "60px auto", padding: "0 1rem" }}>
      <h1>Attendance</h1>
      <p>You haven&apos;t signed in today.</p>
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
        {loading ? "Signing in..." : "Sign in"}
      </button>
      {error && <p style={{ color: "#dc2626", marginTop: "1rem" }}>{error}</p>}
    </div>
  );
}
