"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface LeaveType {
  id: string;
  name: string;
  isAnnualRecurring: boolean;
  mappedStatus: string;
}

interface Balance {
  leaveTypeId: string;
  leaveTypeName: string;
  isAnnualRecurring: boolean;
  granted: number;
  used: number;
  remaining: number;
}

interface UserSummary {
  userId: string;
  userName: string;
  balances: Balance[];
}

interface Props {
  initialSummary: UserSummary[];
  leaveTypes: LeaveType[];
}

export default function BalancesClient({ initialSummary, leaveTypes }: Props) {
  const router = useRouter();
  const [summary, setSummary] = useState<UserSummary[]>(initialSummary);
  const [selectedUserId, setSelectedUserId] = useState(summary[0]?.userId ?? "");
  const [showForm, setShowForm] = useState(false);
  const [grantTypeId, setGrantTypeId] = useState(leaveTypes[0]?.id ?? "");
  const [grantDays, setGrantDays] = useState(20);
  const [grantDate, setGrantDate] = useState(adisToday());
  const [grantNote, setGrantNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (grantTypeId) {
      const selected = leaveTypes.find((t) => t.id === grantTypeId);
      if (selected?.name === "Annual Leave") {
        setGrantDays(20);
      }
    }
  }, [grantTypeId, leaveTypes]);

  const selectedUser = summary.find((s) => s.userId === selectedUserId);

  async function handleAddGrant(e: React.FormEvent) {
    e.preventDefault();
    if (grantDays <= 0 || !selectedUserId || !grantTypeId) return;

    setSaving(true);
    setError("");

    const res = await fetch("/api/leave-grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: selectedUserId,
        leaveTypeId: grantTypeId,
        days: grantDays,
        grantedDate: grantDate,
        note: grantNote || undefined,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to add grant.");
      setSaving(false);
      return;
    }

    const refreshRes = await fetch(`/api/leave-balances?userId=${selectedUserId}`);
    const refreshData = await refreshRes.json();
    if (refreshRes.ok) {
      setSummary((prev) =>
        prev.map((s) => (s.userId === selectedUserId ? { ...s, balances: refreshData.balances } : s))
      );
    }

    setShowForm(false);
    setGrantDays(20);
    setGrantDate(adisToday());
    setGrantNote("");
    setSaving(false);
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 1rem" }}>
      <h1>Leave Balances</h1>

      <div style={{ marginBottom: "1.5rem" }}>
        <label style={{ display: "block", fontWeight: 500, marginBottom: "0.25rem" }}>
          Staff Member
        </label>
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          style={{ padding: "0.5rem", minWidth: 220 }}
        >
          {summary.map((s) => (
            <option key={s.userId} value={s.userId}>
              {s.userName}
            </option>
          ))}
        </select>
      </div>

      {selectedUser && (
        <table
          style={{ width: "100%", borderCollapse: "collapse", marginBottom: "1.5rem" }}
        >
          <thead>
            <tr
              style={{
                borderBottom: "2px solid #e5e7eb",
                textAlign: "left",
                backgroundColor: "#f9fafb",
              }}
            >
              <th style={{ padding: "0.75rem 0.5rem" }}>Leave Type</th>
              <th style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>Granted</th>
              <th style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>Used</th>
              <th style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>Remaining</th>
            </tr>
          </thead>
          <tbody>
            {selectedUser.balances.map((b) => (
              <tr key={b.leaveTypeId} style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "0.5rem" }}>
                  <strong>{b.leaveTypeName}</strong>
                  {b.isAnnualRecurring && (
                    <span style={{ fontSize: "0.8rem", color: "#6b7280", marginLeft: "0.5rem" }}>
                      (annual)
                    </span>
                  )}
                </td>
                <td style={{ padding: "0.5rem", textAlign: "center" }}>{b.granted}</td>
                <td style={{ padding: "0.5rem", textAlign: "center" }}>{b.used}</td>
                <td
                  style={{
                    padding: "0.5rem",
                    textAlign: "center",
                    fontWeight: 600,
                    color: b.remaining < 0 ? "#dc2626" : b.remaining === 0 ? "#d97706" : "#16a34a",
                  }}
                >
                  {b.remaining}
                </td>
              </tr>
            ))}
            {selectedUser.balances.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "1rem", textAlign: "center", color: "#6b7280" }}>
                  No leave types exist yet. Set up leave types first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "0.375rem",
            cursor: "pointer",
          }}
        >
          + Add Grant
        </button>
      )}

      {showForm && (
        <form
          onSubmit={handleAddGrant}
          style={{
            padding: "1rem",
            border: "1px solid #e5e7eb",
            borderRadius: "0.375rem",
            marginTop: "1rem",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Add Grant for {selectedUser?.userName}</h3>

          <div style={{ marginBottom: "0.75rem" }}>
            <label style={{ display: "block", fontWeight: 500, marginBottom: "0.25rem" }}>
              Leave Type
            </label>
            <select
              value={grantTypeId}
              onChange={(e) => setGrantTypeId(e.target.value)}
              style={{ padding: "0.5rem", minWidth: 200 }}
            >
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "0.75rem" }}>
            <label style={{ display: "block", fontWeight: 500, marginBottom: "0.25rem" }}>
              Days
            </label>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={grantDays}
              onChange={(e) => setGrantDays(Number(e.target.value))}
              style={{ width: "100px", padding: "0.5rem" }}
            />
          </div>

          <div style={{ marginBottom: "0.75rem" }}>
            <label style={{ display: "block", fontWeight: 500, marginBottom: "0.25rem" }}>
              Grant Date
            </label>
            <input
              type="date"
              value={grantDate}
              onChange={(e) => setGrantDate(e.target.value)}
              style={{ padding: "0.5rem" }}
            />
          </div>

          <div style={{ marginBottom: "0.75rem" }}>
            <label style={{ display: "block", fontWeight: 500, marginBottom: "0.25rem" }}>
              Note (optional)
            </label>
            <input
              type="text"
              value={grantNote}
              onChange={(e) => setGrantNote(e.target.value)}
              placeholder="e.g. Annual leave 2026"
              style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }}
            />
          </div>

          {error && <p style={{ color: "#dc2626", marginBottom: "0.5rem" }}>{error}</p>}

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#16a34a",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                cursor: "pointer",
              }}
            >
              {saving ? "Saving..." : "Add Grant"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setError("");
              }}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#9ca3af",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
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
