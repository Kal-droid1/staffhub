"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/modules/core/components/card";
import StatusPill from "@/modules/core/components/status-pill";
import PersonRow from "@/modules/core/components/person-row";

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
      <div className="page-container" style={{ maxWidth: 600 }}>
        <h1 className="page-title">Pending Approvals</h1>
        <Card>
          <p className="text-muted text-center" style={{ padding: "1.5rem 0", margin: 0 }}>
            No pending attendance records.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: 1000 }}>
      <h1 className="page-title">Pending Approvals</h1>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table className="table-card" style={{ boxShadow: "none", border: "none", borderRadius: 0 }}>
          <thead>
            <tr>
              <th>Staff</th>
              <th>Date</th>
              <th>Requested</th>
              <th>Sign-in</th>
              <th>Note</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const warning = getBalanceWarning(r);
              const displayStatus = r.leaveTypeId
                ? getLeaveTypeName(r.leaveTypeId) ?? r.requestedStatus
                : r.requestedStatus;
              return (
                <tr key={r.id}>
                  <td>
                    <PersonRow
                      name={r.user.name}
                      department={r.user.department ?? undefined}
                      size="sm"
                    />
                  </td>
                  <td>{new Date(r.date).toLocaleDateString()}</td>
                  <td>
                    <StatusPill
                      status={r.requestedStatus.toLowerCase() === "present" ? "present" : "pending"}
                      label={displayStatus}
                    />
                  </td>
                  <td>
                    {r.signInTime
                      ? new Date(r.signInTime).toLocaleTimeString()
                      : "\u2014"}
                  </td>
                  <td className="text-muted">{r.note || "\u2014"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {warning && (
                      <div className="mb-1">
                        <span className="status-pill status-pill--danger" style={{ fontSize: "0.7rem" }}>
                          {warning}
                        </span>
                      </div>
                    )}
                    <div className="flex-row gap-sm">
                      <button
                        onClick={() => handleAction(r.id, "approve")}
                        disabled={loadingId === r.id}
                        className="btn btn-success btn-sm"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(r.id, "reject")}
                        disabled={loadingId === r.id}
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
      </Card>
    </div>
  );
}
