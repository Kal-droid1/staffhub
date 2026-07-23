"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PendingRecord {
  id: string;
  date: string;
  signInTime: string | null;
  requestedStatus: string;
  leaveTypeId: string | null;
  note: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    department: string | null;
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
}

interface Props {
  pendingRecords: PendingRecord[];
  balances: Record<string, Balance[]>;
  leaveTypes: LeaveType[];
}

export default function ApproveClient({ pendingRecords, balances, leaveTypes }: Props) {
  const router = useRouter();
  const [records, setRecords] = useState<PendingRecord[]>(pendingRecords);
  const [loadingId, setLoadingId] = useState<string | null>(null);

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
      return `Balance would be negative (remaining: ${matching.remaining} day${matching.remaining !== 1 ? "s" : ""})`;
    }
    return null;
  }

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
          {records.map((r) => {
            const warning = getBalanceWarning(r);
            const displayStatus = r.leaveTypeId
              ? getLeaveTypeName(r.leaveTypeId) ?? r.requestedStatus
              : r.requestedStatus;
            return (
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
                <td style={{ padding: "0.5rem" }}>{displayStatus}</td>
                <td style={{ padding: "0.5rem" }}>
                  {r.signInTime
                    ? new Date(r.signInTime).toLocaleTimeString()
                    : "\u2014"}
                </td>
                <td style={{ padding: "0.5rem" }}>{r.note || "\u2014"}</td>
                <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                  {warning && (
                    <div style={{ fontSize: "0.8rem", color: "#dc2626", marginBottom: "0.25rem" }}>
                      {"\u26A0"} {warning}
                    </div>
                  )}
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
