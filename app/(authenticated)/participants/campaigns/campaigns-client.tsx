"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Card from "@/modules/core/components/card";

interface Campaign {
  id: string;
  name: string;
  visibility: string;
  status: string;
  createdByName: string;
  createdById: string;
  createdAt: string;
  archivedAt: string | null;
  archivedByName: string | null;
}

export default function CampaignsClient() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState("ALL_STAFF");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/participants/campaigns?status=ACTIVE");
      const data = await res.json();
      setCampaigns(data);
    } catch {
      setError("Failed to load campaigns");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/participants/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), visibility }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Failed to create");
        setSaving(false);
        return;
      }
      setShowForm(false);
      setName("");
      setVisibility("ALL_STAFF");
      await fetchCampaigns();
    } catch {
      setError("Network error");
    }
    setSaving(false);
  }

  async function handleArchive(id: string) {
    if (!confirm("Archive this campaign? It will become read-only.")) return;
    setArchivingId(id);
    try {
      const res = await fetch(`/api/participants/campaigns/${id}`, { method: "PATCH" });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Failed to archive");
        setArchivingId(null);
        return;
      }
      await fetchCampaigns();
    } catch {
      setError("Network error");
    }
    setArchivingId(null);
  }

  return (
    <div className="page-container" style={{ maxWidth: 800 }}>
      <h1 className="page-title">Checklist Campaigns</h1>

      {!showForm && (
        <button onClick={() => setShowForm(true)} className="btn btn-primary mb-2">
          + New Campaign
        </button>
      )}

      {showForm && (
        <Card style={{ marginBottom: "1.5rem" }}>
          <form onSubmit={handleCreate}>
            <h3 style={{ marginTop: 0, color: "var(--color-brand)", fontSize: "1rem" }}>
              New Campaign
            </h3>

            <div style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Campaign Name</label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Report Card Term 1 2026"
                required
              />
            </div>

            <div style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Visibility</label>
              <select
                className="form-select"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
              >
                <option value="ALL_STAFF">All Staff</option>
                <option value="CREATOR_ONLY">Only Me</option>
              </select>
            </div>

            {error && <p className="form-error mb-1">{error}</p>}

            <div className="flex-row gap-sm">
              <button type="submit" disabled={saving} className="btn btn-success">
                {saving ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(""); }}
                className="btn btn-ghost"
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {loading && (
        <Card><p className="text-muted text-center" style={{ padding: "1rem 0", margin: 0 }}>Loading...</p></Card>
      )}

      {!loading && campaigns.length === 0 && (
        <Card>
          <p className="text-muted text-center" style={{ padding: "1rem 0", margin: 0 }}>
            No active campaigns. Create one above.
          </p>
        </Card>
      )}

      {!loading && campaigns.length > 0 && (
        <div className="table-responsive">
          <table className="table-card">
            <thead>
              <tr>
                <th>Name</th>
                <th>Visibility</th>
                <th>Created By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td data-label="Name" style={{ fontWeight: 600 }}>{c.name}</td>
                  <td data-label="Visibility">
                    <span className={c.visibility === "CREATOR_ONLY" ? "status-pill status-pill--warning" : "status-pill status-pill--success"}>
                      {c.visibility === "CREATOR_ONLY" ? "Private" : "All Staff"}
                    </span>
                  </td>
                  <td data-label="Created By">{c.createdByName}</td>
                  <td data-label="Actions">
                    <button
                      onClick={() => handleArchive(c.id)}
                      disabled={archivingId === c.id}
                      className="btn btn-ghost btn-sm"
                    >
                      {archivingId === c.id ? "Archiving..." : "Archive"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
