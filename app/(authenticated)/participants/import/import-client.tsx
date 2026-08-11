"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/modules/core/components/card";

export default function ImportClient() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; total: number; errors: string[] } | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError("");
    setResult(null);

    try {
      const html = await file.text();
      const res = await fetch("/api/participants/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Import failed");
      } else {
        setResult(data);
      }
    } catch {
      setError("Failed to read file or upload.");
    }

    setUploading(false);
  }

  return (
    <div className="page-container" style={{ maxWidth: 700 }}>
      <button
        onClick={() => router.back()}
        className="btn btn-ghost mb-1"
        style={{ fontSize: "0.85rem" }}
      >
        &larr; Back
      </button>

      <h1 className="page-title">Import Participants</h1>

      <Card style={{ marginBottom: "1.5rem" }}>
        <p className="text-muted" style={{ marginTop: 0 }}>
          Upload an HTML-formatted <code>.xls</code> export file (the same format used for the
          original import). Each row is matched by Local Participant ID — existing records are
          updated and new ones are created. Existing participants not in the file are left unchanged.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label className="form-label">Select file</label>
            <input
              type="file"
              accept=".xls,.xlsx,.html,.htm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="form-input"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={!file || uploading}
          >
            {uploading ? "Importing..." : "Import"}
          </button>
        </form>
      </Card>

      {error && (
        <Card>
          <p className="form-error" style={{ margin: 0 }}>{error}</p>
        </Card>
      )}

      {result && (
        <Card>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem" }}>Import Results</h2>
          <div style={{ display: "flex", gap: "2rem", marginBottom: "0.75rem" }}>
            <div>
              <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "var(--color-brand)" }}>
                {result.created}
              </p>
              <p className="text-muted" style={{ margin: 0, fontSize: "0.8rem" }}>Created</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "var(--color-brand)" }}>
                {result.updated}
              </p>
              <p className="text-muted" style={{ margin: 0, fontSize: "0.8rem" }}>Updated</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "var(--color-brand)" }}>
                {result.total}
              </p>
              <p className="text-muted" style={{ margin: 0, fontSize: "0.8rem" }}>Total rows</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <p className="form-error" style={{ margin: "0 0 0.25rem" }}>Errors:</p>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.85rem", color: "var(--color-danger)" }}>
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
