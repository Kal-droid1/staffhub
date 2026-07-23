"use client";

import { useState } from "react";
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

interface Grant {
  id: string;
  userId: string;
  leaveTypeId: string;
  days: number;
  grantedDate: string;
  note: string | null;
  expiresAt: string | null;
  user: { id: string; name: string; email: string };
  leaveType: { id: string; name: string };
}

interface Props {
  initialSummary: UserSummary[];
  leaveTypes: LeaveType[];
  initialGrants: Grant[];
}

export default function BalancesClient({ initialSummary, leaveTypes, initialGrants }: Props) {
  const router = useRouter();
  const [summary, setSummary] = useState<UserSummary[]>(initialSummary);
  const [grants, setGrants] = useState<Grant[]>(initialGrants);
  const [selectedUserId, setSelectedUserId] = useState(summary[0]?.userId ?? "");

  const [showGrantForm, setShowGrantForm] = useState(false);
  const [editingGrantId, setEditingGrantId] = useState<string | null>(null);
  const [grantTypeId, setGrantTypeId] = useState(leaveTypes[0]?.id ?? "");
  const [grantDays, setGrantDays] = useState(20);
  const [grantDate, setGrantDate] = useState(adisToday());
  const [grantNote, setGrantNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showBulk, setShowBulk] = useState(false);
  const [bulkTypeId, setBulkTypeId] = useState(leaveTypes[0]?.id ?? "");
  const [bulkDays, setBulkDays] = useState(20);
  const [bulkDate, setBulkDate] = useState(adisToday());
  const [bulkNote, setBulkNote] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState("");

  const selectedUser = summary.find((s) => s.userId === selectedUserId);
  const userGrants = grants.filter((g) => g.userId === selectedUserId);

  async function refreshBalances() {
    const refreshRes = await fetch(`/api/leave-balances?userId=${selectedUserId}`);
    const refreshData = await refreshRes.json();
    if (refreshRes.ok) {
      setSummary((prev) =>
        prev.map((s) => (s.userId === selectedUserId ? { ...s, balances: refreshData.balances } : s))
      );
    }
  }

  async function handleSaveGrant(e: React.FormEvent) {
    e.preventDefault();
    if (grantDays <= 0 || !selectedUserId || !grantTypeId) return;
    setSaving(true);
    setError("");

    const url = "/api/leave-grants";
    const method = editingGrantId ? "PUT" : "POST";

    const body: Record<string, unknown> = editingGrantId
      ? { id: editingGrantId, days: grantDays, grantedDate: grantDate, note: grantNote || undefined }
      : { userId: selectedUserId, leaveTypeId: grantTypeId, days: grantDays, grantedDate: grantDate, note: grantNote || undefined };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to save grant.");
      setSaving(false);
      return;
    }

    const grantsRes = await fetch("/api/leave-grants");
    const grantsData = await grantsRes.json();
    if (grantsRes.ok) setGrants(grantsData);

    await refreshBalances();

    setShowGrantForm(false);
    setEditingGrantId(null);
    setGrantDays(20);
    setGrantDate(adisToday());
    setGrantNote("");
    setSaving(false);
    router.refresh();
  }

  async function handleDeleteGrant(grantId: string) {
    const res = await fetch(`/api/leave-grants?id=${grantId}`, { method: "DELETE" });
    if (res.ok) {
      setGrants((prev) => prev.filter((g) => g.id !== grantId));
      await refreshBalances();
      router.refresh();
    }
  }

  function startEdit(g: Grant) {
    setEditingGrantId(g.id);
    setGrantTypeId(g.leaveTypeId);
    setGrantDays(g.days);
    setGrantDate(g.grantedDate.slice(0, 10));
    setGrantNote(g.note ?? "");
    setShowGrantForm(true);
  }

  async function handleBulkGrant(e: React.FormEvent) {
    e.preventDefault();
    if (bulkDays <= 0 || !bulkTypeId) return;
    setBulkSaving(true);
    setBulkError("");

    const res = await fetch("/api/leave-grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bulk: true,
        leaveTypeId: bulkTypeId,
        days: bulkDays,
        grantedDate: bulkDate,
        note: bulkNote || undefined,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setBulkError(data.error || "Failed to create bulk grants.");
      setBulkSaving(false);
      return;
    }

    const grantsRes = await fetch("/api/leave-grants");
    const grantsData = await grantsRes.json();
    if (grantsRes.ok) setGrants(grantsData);

    const summaryRes = await fetch("/api/leave-balances");
    const summaryData = await summaryRes.json();
    if (summaryRes.ok) setSummary(summaryData);

    setShowBulk(false);
    setBulkDays(20);
    setBulkDate(adisToday());
    setBulkNote("");
    setBulkSaving(false);
    router.refresh();
  }

  function getGrantTypeName(typeId: string): string {
    return leaveTypes.find((t) => t.id === typeId)?.name ?? typeId;
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 1rem" }}>
      <h1>Leave Balances</h1>

      <div style={{ marginBottom: "1.5rem", display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
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
      </div>

      {selectedUser && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "1.5rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left", backgroundColor: "#f9fafb" }}>
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
                    <span style={{ fontSize: "0.8rem", color: "#6b7280", marginLeft: "0.5rem" }}>(annual)</span>
                  )}
                </td>
                <td style={{ padding: "0.5rem", textAlign: "center" }}>{b.granted}</td>
                <td style={{ padding: "0.5rem", textAlign: "center" }}>{b.used}</td>
                <td style={{
                  padding: "0.5rem", textAlign: "center", fontWeight: 600,
                  color: b.remaining < 0 ? "#dc2626" : b.remaining === 0 ? "#d97706" : "#16a34a",
                }}>
                  {b.remaining}
                </td>
              </tr>
            ))}
            {selectedUser.balances.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "1rem", textAlign: "center", color: "#6b7280" }}>
                  No leave types exist yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {!showGrantForm && (
          <button
            onClick={() => setShowGrantForm(true)}
            style={{ padding: "0.5rem 1rem", backgroundColor: "#2563eb", color: "white", border: "none", borderRadius: "0.375rem", cursor: "pointer" }}
          >
            + Add Grant
          </button>
        )}
        {!showBulk && (
          <button
            onClick={() => setShowBulk(true)}
            style={{ padding: "0.5rem 1rem", backgroundColor: "#7c3aed", color: "white", border: "none", borderRadius: "0.375rem", cursor: "pointer" }}
          >
            Grant to All Staff
          </button>
        )}
      </div>

      {showBulk && (
        <form onSubmit={handleBulkGrant} style={{ padding: "1rem", border: "1px solid #e5e7eb", borderRadius: "0.375rem", marginBottom: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Grant to All Staff</h3>
          <div style={{ marginBottom: "0.75rem" }}>
            <label style={{ display: "block", fontWeight: 500, marginBottom: "0.25rem" }}>Leave Type</label>
            <select value={bulkTypeId} onChange={(e) => setBulkTypeId(e.target.value)} style={{ padding: "0.5rem", minWidth: 200 }}>
              {leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: "0.75rem" }}>
            <label style={{ display: "block", fontWeight: 500, marginBottom: "0.25rem" }}>Days</label>
            <input type="number" min="0.5" step="0.5" value={bulkDays} onChange={(e) => setBulkDays(Number(e.target.value))} style={{ width: "100px", padding: "0.5rem" }} />
          </div>
          <div style={{ marginBottom: "0.75rem" }}>
            <label style={{ display: "block", fontWeight: 500, marginBottom: "0.25rem" }}>Grant Date</label>
            <input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} style={{ padding: "0.5rem" }} />
          </div>
          <div style={{ marginBottom: "0.75rem" }}>
            <label style={{ display: "block", fontWeight: 500, marginBottom: "0.25rem" }}>Note (optional)</label>
            <input type="text" value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} placeholder="e.g. Q2 2026 grant" style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }} />
          </div>
          {bulkError && <p style={{ color: "#dc2626", marginBottom: "0.5rem" }}>{bulkError}</p>}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" disabled={bulkSaving} style={{ padding: "0.5rem 1rem", backgroundColor: "#16a34a", color: "white", border: "none", borderRadius: "0.375rem", cursor: "pointer" }}>
              {bulkSaving ? "Granting..." : "Grant to All"}
            </button>
            <button type="button" onClick={() => { setShowBulk(false); setBulkError(""); }} style={{ padding: "0.5rem 1rem", backgroundColor: "#9ca3af", color: "white", border: "none", borderRadius: "0.375rem", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {showGrantForm && (
        <form onSubmit={handleSaveGrant} style={{ padding: "1rem", border: "1px solid #e5e7eb", borderRadius: "0.375rem", marginBottom: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>{editingGrantId ? "Edit Grant" : `Add Grant for ${selectedUser?.userName}`}</h3>
          {!editingGrantId && (
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", fontWeight: 500, marginBottom: "0.25rem" }}>Leave Type</label>
              <select value={grantTypeId} onChange={(e) => setGrantTypeId(e.target.value)} style={{ padding: "0.5rem", minWidth: 200 }}>
                {leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          <div style={{ marginBottom: "0.75rem" }}>
            <label style={{ display: "block", fontWeight: 500, marginBottom: "0.25rem" }}>Days</label>
            <input type="number" min="0.5" step="0.5" value={grantDays} onChange={(e) => setGrantDays(Number(e.target.value))} style={{ width: "100px", padding: "0.5rem" }} />
          </div>
          <div style={{ marginBottom: "0.75rem" }}>
            <label style={{ display: "block", fontWeight: 500, marginBottom: "0.25rem" }}>Grant Date</label>
            <input type="date" value={grantDate} onChange={(e) => setGrantDate(e.target.value)} style={{ padding: "0.5rem" }} />
          </div>
          <div style={{ marginBottom: "0.75rem" }}>
            <label style={{ display: "block", fontWeight: 500, marginBottom: "0.25rem" }}>Note (optional)</label>
            <input type="text" value={grantNote} onChange={(e) => setGrantNote(e.target.value)} placeholder="e.g. Annual leave 2026" style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }} />
          </div>
          {error && <p style={{ color: "#dc2626", marginBottom: "0.5rem" }}>{error}</p>}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" disabled={saving} style={{ padding: "0.5rem 1rem", backgroundColor: "#16a34a", color: "white", border: "none", borderRadius: "0.375rem", cursor: "pointer" }}>
              {saving ? "Saving..." : editingGrantId ? "Update" : "Add Grant"}
            </button>
            <button type="button" onClick={() => { setShowGrantForm(false); setEditingGrantId(null); setError(""); }} style={{ padding: "0.5rem 1rem", backgroundColor: "#9ca3af", color: "white", border: "none", borderRadius: "0.375rem", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {userGrants.length > 0 && (
        <>
          <h2 style={{ marginTop: "2rem" }}>Grants for {selectedUser?.userName}</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.5rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left", backgroundColor: "#f9fafb" }}>
                <th style={{ padding: "0.5rem" }}>Type</th>
                <th style={{ padding: "0.5rem", textAlign: "center" }}>Days</th>
                <th style={{ padding: "0.5rem" }}>Granted</th>
                <th style={{ padding: "0.5rem" }}>Expires</th>
                <th style={{ padding: "0.5rem" }}>Note</th>
                <th style={{ padding: "0.5rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {userGrants.map((g) => (
                <tr key={g.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "0.5rem" }}>{getGrantTypeName(g.leaveTypeId)}</td>
                  <td style={{ padding: "0.5rem", textAlign: "center" }}>{g.days}</td>
                  <td style={{ padding: "0.5rem" }}>{g.grantedDate.slice(0, 10)}</td>
                  <td style={{ padding: "0.5rem" }}>{g.expiresAt ? g.expiresAt.slice(0, 10) : "Never"}</td>
                  <td style={{ padding: "0.5rem", fontSize: "0.9rem", color: "#6b7280" }}>{g.note || "\u2014"}</td>
                  <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                    <button onClick={() => startEdit(g)} style={{ padding: "0.25rem 0.5rem", marginRight: "0.25rem", backgroundColor: "#2563eb", color: "white", border: "none", borderRadius: "0.25rem", cursor: "pointer", fontSize: "0.85rem" }}>
                      Edit
                    </button>
                    <button onClick={() => handleDeleteGrant(g.id)} style={{ padding: "0.25rem 0.5rem", backgroundColor: "#dc2626", color: "white", border: "none", borderRadius: "0.25rem", cursor: "pointer", fontSize: "0.85rem" }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
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
