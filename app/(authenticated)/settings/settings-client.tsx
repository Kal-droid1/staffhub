"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <div style={{ maxWidth: 500, margin: "40px auto", padding: "0 1rem" }}>
      <h1>Settings</h1>

      <form onSubmit={handleSave} style={{ marginTop: "1rem" }}>
        <div style={{ marginBottom: "1rem" }}>
          <label
            htmlFor="cutoffTime"
            style={{ display: "block", marginBottom: "0.25rem", fontWeight: 500 }}
          >
            Daily sign-in cutoff time (24-hour format)
          </label>
          <input
            id="cutoffTime"
            type="text"
            value={cutoffTime}
            onChange={(e) => setCutoffTime(e.target.value)}
            placeholder="09:00"
            style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }}
          />
          <p style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: "0.25rem" }}>
            The daily auto-absent check runs at 11:00 AM Addis Ababa time.
            Cutoff must be no later than 10:30.
          </p>
        </div>

        {error && (
          <p style={{ color: "#dc2626", marginBottom: "0.5rem" }}>{error}</p>
        )}
        {success && (
          <p style={{ color: "#16a34a", marginBottom: "0.5rem" }}>{success}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "0.25rem",
            cursor: "pointer",
          }}
        >
          {loading ? "Saving..." : "Save"}
        </button>
      </form>
    </div>
  );
}
