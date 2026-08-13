"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

interface Participant {
  id: string;
  localParticipantId: string;
  name: string;
  gradeLevel: string | null;
  gender: string;
  ageText: string | null;
  communityName: string;
  status: string;
}

interface ParticipantDetail extends Participant {
  fcpId: string;
  fcpName: string;
}

export default function GlobalParticipantSearch() {
  const { data: session } = useSession();
  const isManager = session?.user?.role === "MANAGER";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Participant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ParticipantDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<ParticipantDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [showImport, setShowImport] = useState(false);

  // Live search with debounce
  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults(null);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/participants?q=${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        setError("Search failed.");
        setResults(null);
      } else {
        const data = await res.json();
        setResults(data);
      }
    } catch {
      setError("Network error.");
      setResults(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults(null);
      setError("");
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setResults(null);
        setError("");
        if (!query.trim()) setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [query]);

  useEffect(() => {
    if (!selectedId) return;
    setDetail(null);
    setDetailLoading(true);
    setEditing(false);
    fetch(`/api/participants/${selectedId}`)
      .then((r) => r.json())
      .then((data) => { setDetail(data); setDetailLoading(false); })
      .catch(() => setDetailLoading(false));
  }, [selectedId]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (editing) { setEditing(false); setEditError(""); return; }
        if (selectedId) { closeDetail(); return; }
        setResults(null);
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [selectedId, editing]);

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
    setEditing(false);
    setEditError("");
  }

  function selectParticipant(id: string) {
    setResults(null);
    setQuery("");
    setSelectedId(id);
  }

  function startEditing() {
    if (!detail) return;
    setEditForm({ ...detail });
    setEditing(true);
    setEditError("");
  }

  function setField(field: keyof ParticipantDetail, value: string) {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  async function handleSave() {
    if (!editForm) return;
    setSaving(true);
    setEditError("");
    try {
      const res = await fetch(`/api/participants/${editForm.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          localParticipantId: editForm.localParticipantId,
          gradeLevel: editForm.gradeLevel,
          gender: editForm.gender,
          ageText: editForm.ageText,
          communityName: editForm.communityName,
          status: editForm.status,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Failed to save");
      }
      const updated = await res.json();
      setDetail(updated);
      setEditForm(updated);
      setEditing(false);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to save");
    }
    setSaving(false);
  }

  return (
    <>
      {/* Search bar */}
      <div
        ref={wrapperRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 60,
          background: "rgba(250, 247, 240, 0.95)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(31,107,77,0.15)",
          height: 42,
          display: "flex",
          alignItems: "center",
          padding: "0 1.5rem",
        }}
      >
        <div style={{ width: "100%", maxWidth: 480, margin: "0 auto", position: "relative" }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search participants by name or ID…"
            style={{
              width: "100%",
              height: 30,
              padding: "0 2rem 0 0.75rem",
              border: "1px solid rgba(31,107,77,0.2)",
              borderRadius: "0.5rem",
              fontSize: "0.8rem",
              fontFamily: "inherit",
              outline: "none",
              background: "#fff",
              color: "var(--color-text)",
            }}
          />
          {loading && (
            <span
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                width: 14,
                height: 14,
                border: "2px solid rgba(31,107,77,0.15)",
                borderTopColor: "#1F6B4D",
                borderRadius: "50%",
                animation: "spin 0.6s linear infinite",
              }}
            />
          )}

          {isManager && (
            <button
              onClick={() => setShowImport(true)}
              style={{
                position: "absolute",
                right: loading ? 30 : 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "#1F6B4D",
                fontSize: "0.65rem",
                fontWeight: 600,
                textDecoration: "none",
                padding: "0.15rem 0.4rem",
                borderRadius: "0.25rem",
                display: loading ? "none" : "flex",
                alignItems: "center",
                gap: "0.2rem",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
              title="Import participants"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "0.85rem" }}>upload</span>
              Import
            </button>
          )}

          {/* Results dropdown */}
          {results !== null && !loading && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                right: 0,
                background: "#FAF7F0",
                borderRadius: "0.75rem",
                border: "1px solid rgba(255, 255, 255, 0.6)",
                boxShadow: "0 12px 40px rgba(31, 107, 77, 0.15), 0 4px 12px rgba(0,0,0,0.08)",
                maxHeight: "50vh",
                overflowY: "auto",
                zIndex: 70,
              }}
            >
              {error && (
                <p style={{ padding: "1rem 1.25rem", margin: 0, color: "#ba1a1a", fontSize: "0.8rem" }}>{error}</p>
              )}

              {results.length === 0 && !error && (
                <p style={{ padding: "1.25rem", margin: 0, textAlign: "center", color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
                  No participants found matching &ldquo;{query}&rdquo;.
                </p>
              )}

              {results.length > 0 && !error && (
                <>
                  <p style={{
                    padding: "0.55rem 1rem",
                    margin: 0,
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    color: "var(--color-text-muted)",
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}>
                    {results.length} result{results.length !== 1 ? "s" : ""}
                  </p>
                  {results.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => selectParticipant(p.id)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "0.6rem 1rem", cursor: "pointer",
                        borderTop: "1px solid rgba(191,201,193,0.15)",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(31,107,77,0.05)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1F6B4D" }}>{p.name}</div>
                        <div style={{ fontSize: "0.65rem", color: "var(--color-text-muted)", marginTop: "0.05rem" }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem" }}>{p.localParticipantId}</span>
                          <span style={{ margin: "0 0.35rem", color: "var(--color-text-light)" }}>·</span>
                          {p.communityName}
                          {p.gradeLevel && <><span style={{ margin: "0 0.35rem", color: "var(--color-text-light)" }}>·</span>Grade {p.gradeLevel}</>}
                          <span style={{ margin: "0 0.35rem", color: "var(--color-text-light)" }}>·</span>
                          {p.gender}
                          {p.ageText && <><span style={{ margin: "0 0.35rem", color: "var(--color-text-light)" }}>·</span>{p.ageText}</>}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Detail/Edit modal */}
      {selectedId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div
            style={{ position: "absolute", inset: 0, background: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(4px)" }}
            onClick={editing ? undefined : closeDetail}
          />
          <div style={{
            position: "relative", background: "#FAF7F0", borderRadius: "12px",
            border: "1px solid rgba(255, 255, 255, 0.4)", boxShadow: "0 20px 40px rgba(31, 107, 77, 0.25)",
            borderTop: "4px solid #D9A441", maxWidth: editing ? 700 : 600, width: "calc(100% - 2rem)",
            maxHeight: "85vh", overflowY: "auto", margin: "0 1rem", padding: "1.5rem",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, color: "#1F6B4D", fontSize: "1.05rem", fontWeight: 700 }}>
                {editing ? "Edit Participant" : "Participant Detail"}
              </h3>
              <button
                onClick={closeDetail}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.5rem", color: "#1F6B4D", lineHeight: 1, padding: "0.25rem" }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {detailLoading || !detail ? (
              <p style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "2rem 0" }}>Loading…</p>
            ) : editing ? (
              /* Edit form */
              <>
                <div className="grid-2-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="form-label">Name</label>
                    <input className="form-input" value={editForm?.name ?? ""} onChange={(e) => setField("name", e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">ID</label>
                    <input className="form-input" value={editForm?.localParticipantId ?? ""} onChange={(e) => setField("localParticipantId", e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Grade Level</label>
                    <input className="form-input" value={editForm?.gradeLevel ?? ""} onChange={(e) => setField("gradeLevel", e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Gender</label>
                    <input className="form-input" value={editForm?.gender ?? ""} onChange={(e) => setField("gender", e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Age</label>
                    <input className="form-input" value={editForm?.ageText ?? ""} onChange={(e) => setField("ageText", e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Community</label>
                    <input className="form-input" value={editForm?.communityName ?? ""} onChange={(e) => setField("communityName", e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Status</label>
                    <input className="form-input" value={editForm?.status ?? ""} onChange={(e) => setField("status", e.target.value)} />
                  </div>
                </div>
                {editError && <p className="form-error" style={{ marginTop: "0.5rem" }}>{editError}</p>}
                <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
                  <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button className="btn btn-ghost" onClick={() => { setEditing(false); setEditError(""); }} disabled={saving}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              /* Detail view */
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
                  <div>
                    <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#1F6B4D", margin: "0 0 0.35rem" }}>
                      {detail.name}
                    </h2>
                    <span style={{
                      display: "inline-block", padding: "0.15rem 0.6rem", borderRadius: "999px",
                      fontSize: "0.65rem", fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
                      textTransform: "uppercase", background: "rgba(31,107,77,0.1)", color: "#1F6B4D",
                      border: "1px solid rgba(31,107,77,0.3)",
                    }}>
                      {detail.status}
                    </span>
                  </div>
                  <button
                    onClick={startEditing}
                    style={{
                      padding: "0.4rem 1rem", background: "#1F6B4D", color: "#fff", border: "none",
                      borderRadius: "0.35rem", fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer",
                      fontFamily: "inherit", boxShadow: "0 2px 6px rgba(31,107,77,0.2)",
                    }}
                  >
                    Edit
                  </button>
                </div>

                <div className="grid-2-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  {([
                    ["ID", detail.localParticipantId, true],
                    ["FCP", `${detail.fcpName} (${detail.fcpId})`, false],
                    ["Community", detail.communityName, false],
                    ["Grade Level", detail.gradeLevel || "\u2014", false],
                    ["Gender", detail.gender || "\u2014", false],
                    ["Age", detail.ageText || "\u2014", false],
                  ] as const).map(([label, value, mono]) => (
                    <div key={label} style={{ background: "rgba(255,255,255,0.5)", borderRadius: "0.5rem", padding: "0.65rem 0.75rem", border: "1px solid rgba(191,201,193,0.2)" }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginBottom: "0.2rem" }}>{label}</div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 600, fontFamily: mono ? "var(--font-mono)" : "inherit" }}>{value}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Import modal */}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </>
  );
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{ created: number; updated: number; total: number; errors: string[] } | null>(null);
  const [error, setError] = useState("");

  const BATCH_SIZE = 25;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true); setError(""); setResult(null);
    try {
      const html = await file.text();
      const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
      if (!tableMatch) { setError("No table found in file."); setUploading(false); return; }
      const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
      const rows: string[] = []; let m: RegExpExecArray | null;
      while ((m = rowRegex.exec(tableMatch[0])) !== null) rows.push(m[0]);
      if (rows.length < 2) { setError("No participant rows found."); setUploading(false); return; }
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      const allRows: Record<string, string>[] = [];
      for (let i = 1; i < rows.length; i++) {
        const cells: string[] = []; let cm: RegExpExecArray | null;
        while ((cm = cellRegex.exec(rows[i])) !== null) cells.push(cm[1].replace(/<[^>]+>/g, "").trim());
        if (cells.length < 9) continue;
        allRows.push({ fcpId: cells[0], fcpName: cells[1], localParticipantId: cells[2], name: cells[3], gradeLevel: cells[4] || "", gender: cells[5] || "", ageText: cells[6] || "", communityName: cells[7], status: cells[8] || "Active" });
      }
      if (allRows.length === 0) { setError("No participant rows found."); setUploading(false); return; }
      setProgress({ done: 0, total: allRows.length });
      let created = 0, updated = 0; const errors: string[] = [];
      for (let start = 0; start < allRows.length; start += BATCH_SIZE) {
        const batch = allRows.slice(start, start + BATCH_SIZE);
        const res = await fetch("/api/participants/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: batch }) });
        const data = await res.json();
        if (!res.ok) errors.push(data.error || "Batch failed");
        else { created += data.created ?? 0; updated += data.updated ?? 0; if (data.errors?.length) errors.push(...data.errors); }
        setProgress({ done: Math.min(start + BATCH_SIZE, allRows.length), total: allRows.length });
      }
      setResult({ created, updated, total: allRows.length, errors });
    } catch { setError("Failed to read file."); }
    setUploading(false);
  }

  const pctDone = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 130, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div style={{ position: "relative", background: "#FAF7F0", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.4)", boxShadow: "0 20px 40px rgba(31,107,77,0.25)", borderTop: "4px solid #D9A441", maxWidth: 600, width: "calc(100% - 2rem)", maxHeight: "85vh", overflowY: "auto", margin: "0 1rem", padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0, color: "#1F6B4D", fontSize: "1.05rem", fontWeight: 700 }}>Import Participants</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.5rem", color: "#1F6B4D", lineHeight: 1, padding: "0.25rem" }} aria-label="Close">✕</button>
        </div>
        <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", margin: "0 0 1rem" }}>Upload an HTML-formatted .xls export. Each row is matched by Local Participant ID — existing records updated, new ones created.</p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}><input type="file" accept=".xls,.xlsx,.html,.htm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={uploading} /></div>
          <button type="submit" className="btn btn-primary" disabled={!file || uploading}>{uploading ? "Importing..." : "Import"}</button>
        </form>
        {uploading && <div style={{ marginTop: "1rem" }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem", fontSize: "0.85rem", color: "var(--color-text-muted)" }}><span>Processing...</span><span>{pctDone}% ({progress.done}/{progress.total})</span></div><div style={{ height: 6, borderRadius: 3, backgroundColor: "var(--color-border)", overflow: "hidden" }}><div style={{ height: "100%", width: `${pctDone}%`, backgroundColor: "var(--color-brand)", borderRadius: 3, transition: "width 0.2s ease" }} /></div></div>}
        {error && <p className="form-error" style={{ marginTop: "0.5rem" }}>{error}</p>}
        {result && <div style={{ marginTop: "1rem" }}><div style={{ display: "flex", gap: "2rem" }}><div><p style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "var(--color-brand)" }}>{result.created}</p><p className="text-muted" style={{ margin: 0, fontSize: "0.8rem" }}>Created</p></div><div><p style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "var(--color-brand)" }}>{result.updated}</p><p className="text-muted" style={{ margin: 0, fontSize: "0.8rem" }}>Updated</p></div></div>{result.errors.length > 0 && <div style={{ marginTop: "0.75rem" }}><ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.85rem", color: "var(--color-danger)" }}>{result.errors.map((err: string, i: number) => <li key={i}>{err}</li>)}</ul></div>}</div>}
      </div>
    </div>
  );
}
