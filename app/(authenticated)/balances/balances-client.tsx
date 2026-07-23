"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/modules/core/components/card";
import RadialGauge from "@/modules/core/components/radial-gauge";
import PersonRow from "@/modules/core/components/person-row";

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
    <div className="page-container">
      <h1 className="page-title">Leave Balances</h1>

      <Card style={{ marginBottom: "1.25rem" }}>
        <div className="flex-row gap-md flex-wrap">
          <div>
            <label className="form-label">Staff Member</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="form-select"
              style={{ minWidth: 220 }}
            >
              {summary.map((s) => (
                <option key={s.userId} value={s.userId}>
                  {s.userName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {selectedUser && (
        <>
          {selectedUser.balances.length === 0 ? (
            <Card>
              <p className="text-muted text-center" style={{ padding: "1rem 0", margin: 0 }}>
                No leave types exist yet.
              </p>
            </Card>
          ) : (
            <div className="card-grid" style={{ marginBottom: "1.25rem" }}>
              {selectedUser.balances.map((b) => {
                const maxVal = Math.max(b.granted, b.remaining + b.used);
                return (
                  <Card key={b.leaveTypeId} hover>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "0.75rem",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: "0.95rem",
                          textAlign: "center",
                          color: "var(--color-text)",
                        }}
                      >
                        {b.leaveTypeName}
                        {b.isAnnualRecurring && (
                          <span className="text-sm text-muted" style={{ marginLeft: "0.35rem" }}>
                            (annual)
                          </span>
                        )}
                      </div>
                      <RadialGauge value={b.remaining} max={maxVal} size={120} strokeWidth={9} />
                      <div className="flex-row gap-lg" style={{ justifyContent: "center" }}>
                        <div style={{ textAlign: "center" }}>
                          <div className="text-sm text-muted">Granted</div>
                          <div style={{ fontWeight: 600 }}>{b.granted}</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div className="text-sm text-muted">Used</div>
                          <div style={{ fontWeight: 600 }}>{b.used}</div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <div className="flex-row gap-sm mb-3 flex-wrap">
        {!showGrantForm && (
          <button onClick={() => setShowGrantForm(true)} className="btn btn-primary">
            + Add Grant
          </button>
        )}
        {!showBulk && (
          <button onClick={() => setShowBulk(true)} className="btn btn-secondary">
            Grant to All Staff
          </button>
        )}
      </div>

      {showBulk && (
        <Card style={{ marginBottom: "1rem" }}>
          <form onSubmit={handleBulkGrant}>
            <h3 style={{ marginTop: 0, color: "var(--color-brand)", fontSize: "1rem" }}>
              Grant to All Staff
            </h3>
            <div className="flex-row gap-md flex-wrap mb-2">
              <div>
                <label className="form-label">Leave Type</label>
                <select
                  value={bulkTypeId}
                  onChange={(e) => setBulkTypeId(e.target.value)}
                  className="form-select"
                  style={{ minWidth: 180 }}
                >
                  {leaveTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Days</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={bulkDays}
                  onChange={(e) => setBulkDays(Number(e.target.value))}
                  className="form-input"
                  style={{ width: 100 }}
                />
              </div>
              <div>
                <label className="form-label">Grant Date</label>
                <input
                  type="date"
                  value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>
            <div style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Note (optional)</label>
              <input
                type="text"
                className="form-input"
                value={bulkNote}
                onChange={(e) => setBulkNote(e.target.value)}
                placeholder="e.g. Q2 2026 grant"
              />
            </div>
            {bulkError && <p className="form-error mb-1">{bulkError}</p>}
            <div className="flex-row gap-sm">
              <button type="submit" disabled={bulkSaving} className="btn btn-success">
                {bulkSaving ? "Granting..." : "Grant to All"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setShowBulk(false);
                  setBulkError("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {showGrantForm && (
        <Card style={{ marginBottom: "1rem" }}>
          <form onSubmit={handleSaveGrant}>
            <h3 style={{ marginTop: 0, color: "var(--color-brand)", fontSize: "1rem" }}>
              {editingGrantId ? "Edit Grant" : `Add Grant for ${selectedUser?.userName}`}
            </h3>
            {!editingGrantId && (
              <div style={{ marginBottom: "0.75rem" }}>
                <label className="form-label">Leave Type</label>
                <select
                  value={grantTypeId}
                  onChange={(e) => setGrantTypeId(e.target.value)}
                  className="form-select"
                  style={{ minWidth: 180 }}
                >
                  {leaveTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex-row gap-md flex-wrap mb-2">
              <div>
                <label className="form-label">Days</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={grantDays}
                  onChange={(e) => setGrantDays(Number(e.target.value))}
                  className="form-input"
                  style={{ width: 100 }}
                />
              </div>
              <div>
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
                className="form-input"
                value={grantNote}
                onChange={(e) => setGrantNote(e.target.value)}
                placeholder="e.g. Annual leave 2026"
              />
            </div>
            {error && <p className="form-error mb-1">{error}</p>}
            <div className="flex-row gap-sm">
              <button type="submit" disabled={saving} className="btn btn-success">
                {saving ? "Saving..." : editingGrantId ? "Update" : "Add Grant"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setShowGrantForm(false);
                  setEditingGrantId(null);
                  setError("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {userGrants.length > 0 && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)" }}>
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "var(--color-brand)" }}>
              Grants for {selectedUser?.userName}
            </h2>
          </div>
          <table className="table-card" style={{ boxShadow: "none", border: "none", borderRadius: 0 }}>
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
              {userGrants.map((g) => (
                <tr key={g.id}>
                  <td style={{ fontWeight: 600 }}>{getGrantTypeName(g.leaveTypeId)}</td>
                  <td style={{ textAlign: "center", fontWeight: 600 }}>{g.days}</td>
                  <td>{g.grantedDate.slice(0, 10)}</td>
                  <td>{g.expiresAt ? g.expiresAt.slice(0, 10) : "Never"}</td>
                  <td className="text-muted">{g.note || "\u2014"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div className="flex-row gap-sm">
                      <button
                        onClick={() => startEdit(g)}
                        className="btn btn-primary btn-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteGrant(g.id)}
                        className="btn btn-danger btn-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
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
