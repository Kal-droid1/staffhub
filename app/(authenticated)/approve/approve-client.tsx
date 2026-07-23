"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PendingRecord {
  id: string;
  date: string;
  signInTime: string | null;
  requestedStatus: string;
  note: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    department: string | null;
  };
}

interface Props {
  pendingRecords: PendingRecord[];
}

export default function ApproveClient({ pendingRecords }: Props) {
  const router = useRouter();
  const [records, setRecords] = useState<PendingRecord[]>(pendingRecords);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleAction(recordId: string, action: "approve" | "reject") {
    setLoadingId(recordId);
    const res = await fetch("/api/attendance/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordId, action }),
    });
    if (res.ok) {
      setRecords((prev) => prev.filter((r) => r.id !== recordId));
    }
    setLoadingId(null);
    router.refresh();
  }

  if (records.length === 0) {
    return (
      <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 1rem" }}>
        <h1>Pending Approvals</h1>
        <p>No pending attendance records.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 1rem" }}>
      <h1>Pending Approvals</h1>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
        <thead>
          <tr
            style={{
              borderBottom: "2px solid #e5e7eb",
              textAlign: "left",
            }}
          >
            <th style={{ padding: "0.5rem" }}>Staff</th>
            <th style={{ padding: "0.5rem" }}>Date</th>
            <th style={{ padding: "0.5rem" }}>Requested</th>
            <th style={{ padding: "0.5rem" }}>Sign-in</th>
            <th style={{ padding: "0.5rem" }}>Note</th>
            <th style={{ padding: "0.5rem" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr
              key={r.id}
              style={{ borderBottom: "1px solid #e5e7eb" }}
            >
              <td style={{ padding: "0.5rem" }}>
                <strong>{r.user.name}</strong>
                {r.user.department && (
                  <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                    {r.user.department}
                  </div>
                )}
              </td>
              <td style={{ padding: "0.5rem" }}>
                {new Date(r.date).toLocaleDateString()}
              </td>
              <td style={{ padding: "0.5rem" }}>{r.requestedStatus}</td>
              <td style={{ padding: "0.5rem" }}>
                {r.signInTime
                  ? new Date(r.signInTime).toLocaleTimeString()
                  : "—"}
              </td>
              <td style={{ padding: "0.5rem" }}>{r.note || "—"}</td>
              <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                <button
                  onClick={() => handleAction(r.id, "approve")}
                  disabled={loadingId === r.id}
                  style={{
                    padding: "0.25rem 0.75rem",
                    marginRight: "0.5rem",
                    backgroundColor: "#16a34a",
                    color: "white",
                    border: "none",
                    borderRadius: "0.25rem",
                    cursor: "pointer",
                  }}
                >
                  Approve
                </button>
                <button
                  onClick={() => handleAction(r.id, "reject")}
                  disabled={loadingId === r.id}
                  style={{
                    padding: "0.25rem 0.75rem",
                    backgroundColor: "#dc2626",
                    color: "white",
                    border: "none",
                    borderRadius: "0.25rem",
                    cursor: "pointer",
                  }}
                >
                  Reject
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
