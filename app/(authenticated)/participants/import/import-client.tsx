"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/modules/core/components/card";

interface ParticipantRow {
  fcpId: string;
  fcpName: string;
  localParticipantId: string;
  name: string;
  gradeLevel: string;
  gender: string;
  ageText: string;
  communityName: string;
  status: string;
}

const BATCH_SIZE = 25;

function parseHtmlTable(html: string): ParticipantRow[] {
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) return [];

  const tableHtml = tableMatch[0];
  const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
  const rows: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = rowRegex.exec(tableHtml)) !== null) {
    rows.push(m[0]);
  }

  if (rows.length < 2) return [];

  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

  const results: ParticipantRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cells: string[] = [];
    let cm: RegExpExecArray | null;
    while ((cm = cellRegex.exec(rows[i])) !== null) {
      cells.push(cm[1].replace(/<[^>]+>/g, "").trim());
    }
    if (cells.length < 9) continue;

    results.push({
      fcpId: cells[0],
      fcpName: cells[1],
      localParticipantId: cells[2],
      name: cells[3],
      gradeLevel: cells[4] || "",
      gender: cells[5] || "",
      ageText: cells[6] || "",
      communityName: cells[7],
      status: cells[8] || "Active",
    });
  }

  return results;
}

export default function ImportClient() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    total: number;
    createdRecords: { name: string; localParticipantId: string }[];
    updatedRecords: { name: string; localParticipantId: string }[];
    errors: string[];
  } | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError("");
    setResult(null);

    try {
      const html = await file.text();
      const allRows = parseHtmlTable(html);
      if (allRows.length === 0) {
        setError("No participant rows found in uploaded file.");
        setUploading(false);
        return;
      }

      setProgress({ done: 0, total: allRows.length });

      let totalCreated = 0;
      let totalUpdated = 0;
      const createdRecords: { name: string; localParticipantId: string }[] = [];
      const updatedRecords: { name: string; localParticipantId: string }[] = [];
      const allErrors: string[] = [];

      for (let start = 0; start < allRows.length; start += BATCH_SIZE) {
        const batch = allRows.slice(start, start + BATCH_SIZE);
        const res = await fetch("/api/participants/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: batch }),
        });

        const data = await res.json();
        if (!res.ok) {
          allErrors.push(data.error || "Batch failed");
        } else {
          totalCreated += data.created ?? 0;
          totalUpdated += data.updated ?? 0;
          createdRecords.push(...(data.createdRecords ?? []));
          updatedRecords.push(...(data.updatedRecords ?? []));
          if (data.errors?.length) allErrors.push(...data.errors);
        }

        setProgress({ done: Math.min(start + BATCH_SIZE, allRows.length), total: allRows.length });
      }

      setResult({
        created: totalCreated,
        updated: totalUpdated,
        total: allRows.length,
        createdRecords,
        updatedRecords,
        errors: allErrors,
      });
    } catch {
      setError("Failed to read file or upload.");
    }

    setUploading(false);
  }

  const pctDone = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

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
              disabled={uploading}
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

        {uploading && (
          <div style={{ marginTop: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
              <span>Processing...</span>
              <span>{pctDone}% ({progress.done}/{progress.total})</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, backgroundColor: "var(--color-border)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${pctDone}%`,
                  backgroundColor: "var(--color-brand)",
                  borderRadius: 3,
                  transition: "width 0.2s ease",
                }}
              />
            </div>
          </div>
        )}
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

          {result.createdRecords.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <p style={{ margin: "0 0 0.25rem", fontWeight: 700, fontSize: "0.9rem", color: "var(--color-brand)" }}>
                Created ({result.createdRecords.length}):
              </p>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "1.25rem",
                  fontSize: "0.85rem",
                  maxHeight: 200,
                  overflowY: "auto",
                }}
              >
                {result.createdRecords.map((r, i) => (
                  <li key={i}>
                    {r.name} ({r.localParticipantId})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.updatedRecords.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <p style={{ margin: "0 0 0.25rem", fontWeight: 700, fontSize: "0.9rem", color: "var(--color-brand)" }}>
                Updated ({result.updatedRecords.length}):
              </p>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "1.25rem",
                  fontSize: "0.85rem",
                  maxHeight: 200,
                  overflowY: "auto",
                }}
              >
                {result.updatedRecords.map((r, i) => (
                  <li key={i}>
                    {r.name} ({r.localParticipantId})
                  </li>
                ))}
              </ul>
            </div>
          )}

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
