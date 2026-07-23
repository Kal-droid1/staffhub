"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/modules/core/components/card";

interface Props {
  cutoffTime: string;
}

export default function SettingsClient({ cutoffTime: initialCutoff }: Props) {
  const router = useRouter();
  const [cutoffTime, setCutoffTime] = useState(initialCutoff);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const res = await fetch("/api/attendance/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cutoffTime }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to update.");
    } else {
      setCutoffTime(data.cutoffTime);
      setSuccess("Settings updated.");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="page-container" style={{ maxWidth: 520 }}>
      <h1 className="page-title">Settings</h1>

      <Card>
        <form onSubmit={handleSave}>
          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="cutoffTime" className="form-label">
              Daily sign-in cutoff time (24-hour format)
            </label>
            <input
              id="cutoffTime"
              type="text"
              className="form-input"
              value={cutoffTime}
              onChange={(e) => setCutoffTime(e.target.value)}
              placeholder="09:00"
            />
            <p className="form-hint">
              The daily auto-absent check runs at 11:00 AM Addis Ababa time.
              Cutoff must be no later than 10:30.
            </p>
          </div>

          {error && <p className="form-error mb-1">{error}</p>}
          {success && <p className="form-success mb-1">{success}</p>}

          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? "Saving..." : "Save"}
          </button>
        </form>
      </Card>
    </div>
  );
}
