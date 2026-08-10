"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Card from "@/modules/core/components/card";

interface ParticipantData {
  id: string;
  localParticipantId: string;
  name: string;
  fcpId: string;
  fcpName: string;
  gradeLevel: string | null;
  gender: string;
  ageText: string | null;
  communityName: string;
  status: string;
}

interface CampaignEntry {
  completed: boolean;
  completedById: string | null;
  completedBy: { name: string } | null;
  completedAt: string | null;
}

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
  entry: CampaignEntry | null;
}

export default function ParticipantDetailClient() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [participant, setParticipant] = useState<ParticipantData | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        fetch(`/api/participants/${id}`),
        fetch(`/api/participants/campaigns?status=ACTIVE&participantId=${id}`),
      ]);
      if (!pRes.ok) {
        if (pRes.status === 404) throw new Error("Participant not found");
        throw new Error("Failed to load");
      }
      const pData = await pRes.json();
      const cData = await cRes.json();
      setParticipant(pData);
      setCampaigns(cData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function toggleEntry(campaignId: string, completed: boolean) {
    setTogglingId(campaignId);
    try {
      const res = await fetch("/api/participants/entries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, participantId: id, completed }),
      });
      if (!res.ok) throw new Error("Failed");
      fetchData();
    } catch {
      setError("Failed to update entry");
    }
    setTogglingId(null);
  }

  if (loading) {
    return (
      <div className="page-container" style={{ maxWidth: 800 }}>
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  if (error || !participant) {
    return (
      <div className="page-container" style={{ maxWidth: 800 }}>
        <Card><p className="form-error">{error || "Not found"}</p></Card>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: 800 }}>
      <button
        onClick={() => router.back()}
        className="btn btn-ghost mb-1"
        style={{ fontSize: "0.85rem" }}
      >
        &larr; Back to search
      </button>

      <Card style={{ marginBottom: "1.5rem" }}>
        <h1 className="page-title" style={{ marginTop: 0 }}>{participant.name}</h1>
        <div className="card-grid card-grid--3" style={{ marginTop: "1rem" }}>
          <div>
            <p className="stat-label">ID</p>
            <p style={{ fontFamily: "monospace", fontSize: "0.9rem", margin: "0.25rem 0 0" }}>
              {participant.localParticipantId}
            </p>
          </div>
          <div>
            <p className="stat-label">FCP</p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.9rem" }}>
              {participant.fcpName} ({participant.fcpId})
            </p>
          </div>
          <div>
            <p className="stat-label">Community</p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.9rem" }}>
              {participant.communityName}
            </p>
          </div>
          <div>
            <p className="stat-label">Grade Level</p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.9rem" }}>
              {participant.gradeLevel || "\u2014"}
            </p>
          </div>
          <div>
            <p className="stat-label">Gender</p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.9rem" }}>
              {participant.gender || "\u2014"}
            </p>
          </div>
          <div>
            <p className="stat-label">Age</p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.9rem" }}>
              {participant.ageText || "\u2014"}
            </p>
          </div>
        </div>
        <p style={{ marginTop: "0.75rem" }}>
          <span className="status-pill status-pill--success">{participant.status}</span>
        </p>
      </Card>

      <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--color-brand)" }}>
        Active Checklists
      </h2>

      {campaigns.length === 0 && (
        <Card>
          <p className="text-muted text-center" style={{ padding: "1rem 0", margin: 0 }}>
            No active checklists. Create one from the Campaigns page.
          </p>
        </Card>
      )}

      {campaigns.map((c) => (
        <Card key={c.id} style={{ marginBottom: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>{c.name}</p>
              <p className="text-sm text-muted" style={{ margin: "0.2rem 0 0" }}>
                by {c.createdByName}
                {c.visibility === "CREATOR_ONLY" && " · private"}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {c.entry?.completed && c.entry.completedBy && (
                <span className="text-sm text-muted">
                  {c.entry.completedBy.name}
                </span>
              )}
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontWeight: 500, fontSize: "0.9rem" }}>
                <input
                  type="checkbox"
                  checked={!!c.entry?.completed}
                  disabled={togglingId === c.id}
                  onChange={(e) => toggleEntry(c.id, e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "var(--color-brand)" }}
                />
                Done
              </label>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
