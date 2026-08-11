"use client";

import { useState, useEffect } from "react";
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

export default function ParticipantDetailClient() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [participant, setParticipant] = useState<ParticipantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ParticipantData | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/participants/${id}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error("Participant not found");
          throw new Error("Failed to load");
        }
        const data = await res.json();
        setParticipant(data);
        setForm(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
      setLoading(false);
    }
    fetchData();
  }, [id]);

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/participants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          localParticipantId: form.localParticipantId,
          gradeLevel: form.gradeLevel,
          gender: form.gender,
          ageText: form.ageText,
          communityName: form.communityName,
          status: form.status,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save");
      }
      const updated = await res.json();
      setParticipant(updated);
      setForm(updated);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    }
    setSaving(false);
  }

  function setField(field: keyof ParticipantData, value: string) {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
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

  const fields = editing ? (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
      <div style={{ gridColumn: "1 / -1" }}>
        <label className="form-label">Name</label>
        <input className="form-input" value={form?.name ?? ""} onChange={(e) => setField("name", e.target.value)} />
      </div>
      <div>
        <label className="form-label">ID</label>
        <input className="form-input" value={form?.localParticipantId ?? ""} onChange={(e) => setField("localParticipantId", e.target.value)} />
      </div>
      <div>
        <label className="form-label">Grade Level</label>
        <input className="form-input" value={form?.gradeLevel ?? ""} onChange={(e) => setField("gradeLevel", e.target.value)} />
      </div>
      <div>
        <label className="form-label">Gender</label>
        <input className="form-input" value={form?.gender ?? ""} onChange={(e) => setField("gender", e.target.value)} />
      </div>
      <div>
        <label className="form-label">Age</label>
        <input className="form-input" value={form?.ageText ?? ""} onChange={(e) => setField("ageText", e.target.value)} />
      </div>
      <div>
        <label className="form-label">Community</label>
        <input className="form-input" value={form?.communityName ?? ""} onChange={(e) => setField("communityName", e.target.value)} />
      </div>
      <div>
        <label className="form-label">Status</label>
        <input className="form-input" value={form?.status ?? ""} onChange={(e) => setField("status", e.target.value)} />
      </div>
    </div>
  ) : (
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
  );

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 className="page-title" style={{ marginTop: 0 }}>{participant.name}</h1>
            <p style={{ marginTop: "0.25rem" }}>
              <span className="status-pill status-pill--success">{participant.status}</span>
            </p>
          </div>
          {!editing && (
            <button className="btn btn-primary" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
        </div>

        {fields}

        {editing && (
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button className="btn btn-ghost" onClick={() => { setEditing(false); setForm(participant); }} disabled={saving}>
              Cancel
            </button>
          </div>
        )}

        {error && <p className="form-error" style={{ marginTop: "0.5rem" }}>{error}</p>}
      </Card>
    </div>
  );
}
