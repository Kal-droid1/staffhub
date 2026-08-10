"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/modules/core/components/card";

interface ArchivedCampaign {
  id: string;
  name: string;
  visibility: string;
  status: string;
  createdByName: string;
  createdAt: string;
  archivedAt: string;
  archivedByName: string | null;
}
interface ParticipantSummary {
  id: string;
  localParticipantId: string;
  name: string;
  gradeLevel: string | null;
  gender: string;
  ageText: string | null;
  communityName: string;
  status: string;
}
interface Entry {
  id: string;
  completed: boolean;
  completedBy: { name: string } | null;
  completedAt: string | null;
  participant: ParticipantSummary;
}

export default function ArchiveClient() {
  const [campaigns, setCampaigns] = useState<ArchivedCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchArchived = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/participants/campaigns?status=ARCHIVED");
      const data = await res.json();
      setCampaigns(data);
    } catch {
      setError("Failed to load");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchArchived();
  }, [fetchArchived]);

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setEntries([]);
      return;
    }
    setExpandedId(id);
    setEntriesLoading(true);
    try {
      const res = await fetch(`/api/participants/campaigns/${id}`);
      const data = await res.json();
      setEntries(data.entries || []);
    } catch {
      setError("Failed to load entries");
    }
    setEntriesLoading(false);
  }

  return (
    <div className="page-container" style={{ maxWidth: 960 }}>
      <h1 className="page-title">Archived Campaigns</h1>

      {error && (
        <Card><p className="form-error" style={{ margin: 0 }}>{error}</p></Card>
      )}

      {loading && (
        <Card><p className="text-muted text-center" style={{ padding: "1rem 0", margin: 0 }}>Loading...</p></Card>
      )}

      {!loading && campaigns.length === 0 && (
        <Card>
          <p className="text-muted text-center" style={{ padding: "1rem 0", margin: 0 }}>
            No archived campaigns yet.
          </p>
        </Card>
      )}

      {!loading && campaigns.map((c) => (
        <Card key={c.id} style={{ marginBottom: "0.75rem" }}>
          <div
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
            onClick={() => toggleExpand(c.id)}
          >
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>{c.name}</p>
              <p className="text-sm text-muted" style={{ margin: "0.2rem 0 0" }}>
                by {c.createdByName}
                {c.visibility === "CREATOR_ONLY" && " · private"}
                {" · "}Archived {new Date(c.archivedAt).toLocaleDateString()}
                {c.archivedByName ? ` by ${c.archivedByName}` : ""}
              </p>
            </div>
            <span className="text-sm text-muted" style={{ whiteSpace: "nowrap" }}>
              {expandedId === c.id ? "\u25B2 Hide" : "\u25BC Show"}
            </span>
          </div>

          {expandedId === c.id && (
            <div style={{ marginTop: "1rem" }}>
              {entriesLoading ? (
                <p className="text-muted text-center" style={{ padding: "0.5rem 0", margin: 0 }}>Loading entries...</p>
              ) : entries.length === 0 ? (
                <p className="text-muted text-center" style={{ padding: "0.5rem 0", margin: 0 }}>No entries.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table-card" style={{ boxShadow: "none", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)" }}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>ID</th>
                        <th>Grade</th>
                        <th>Gender</th>
                        <th>Completed</th>
                        <th>By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((e) => (
                        <tr key={e.id}>
                          <td data-label="Name" style={{ fontWeight: 600 }}>{e.participant.name}</td>
                          <td data-label="ID" style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                            {e.participant.localParticipantId}
                          </td>
                          <td data-label="Grade">{e.participant.gradeLevel || "\u2014"}</td>
                          <td data-label="Gender">{e.participant.gender || "\u2014"}</td>
                          <td data-label="Completed">
                            {e.completed ? (
                              <span className="status-pill status-pill--success">Done</span>
                            ) : (
                              <span className="status-pill status-pill--danger">Not done</span>
                            )}
                          </td>
                          <td data-label="By">{e.completedBy?.name || "\u2014"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
