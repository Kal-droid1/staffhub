"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Participant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ParticipantDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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
    setDetailLoading(true);
    fetch(`/api/participants/${selectedId}`)
      .then((r) => r.json())
      .then((data) => { setDetail(data); setDetailLoading(false); })
      .catch(() => setDetailLoading(false));
  }, [selectedId]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (selectedId) { closeDetail(); return; }
        setResults(null);
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [selectedId]);

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
  }

  function selectParticipant(id: string) {
    setResults(null);
    setQuery("");
    setSelectedId(id);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/participants?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        setError("Search failed.");
        setResults(null);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setResults(data);
    } catch {
      setError("Network error.");
      setResults(null);
    }

    setLoading(false);
  }

  return (
    <>
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
        <form
          onSubmit={handleSearch}
          style={{ width: "100%", maxWidth: 480, margin: "0 auto", position: "relative" }}
        >
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
                fontSize: "0.65rem",
                color: "var(--color-text-muted)",
              }}
            >
              …
            </span>
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
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.6rem 1rem",
                        cursor: "pointer",
                        borderTop: "1px solid rgba(191,201,193,0.15)",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(31,107,77,0.05)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1F6B4D" }}>
                          {p.name}
                        </div>
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
                      <span style={{
                        display: "inline-block",
                        padding: "0.1rem 0.4rem",
                        borderRadius: "999px",
                        fontSize: "0.6rem",
                        fontWeight: 700,
                        fontFamily: "var(--font-mono)",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        background: "rgba(31,107,77,0.1)",
                        color: "#1F6B4D",
                        border: "1px solid rgba(31,107,77,0.3)",
                        flexShrink: 0,
                        marginLeft: "0.75rem",
                      }}>
                        {p.status}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </form>
      </div>

      {/* Detail modal */}
      {selectedId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 120,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0, 0, 0, 0.4)",
              backdropFilter: "blur(4px)",
            }}
            onClick={closeDetail}
          />
          <div
            style={{
              position: "relative",
              background: "#FAF7F0",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.4)",
              boxShadow: "0 20px 40px rgba(31, 107, 77, 0.25)",
              borderTop: "4px solid #D9A441",
              maxWidth: 600,
              width: "calc(100% - 2rem)",
              maxHeight: "85vh",
              overflowY: "auto",
              margin: "0 1rem",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, color: "#1F6B4D", fontSize: "1.05rem", fontWeight: 700 }}>
                Participant Detail
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
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
                  <div>
                    <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#1F6B4D", margin: "0 0 0.35rem" }}>
                      {detail.name}
                    </h2>
                    <span style={{
                      display: "inline-block",
                      padding: "0.15rem 0.6rem",
                      borderRadius: "999px",
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      background: "rgba(31,107,77,0.1)",
                      color: "#1F6B4D",
                      border: "1px solid rgba(31,107,77,0.3)",
                    }}>
                      {detail.status}
                    </span>
                  </div>
                  <button
                    onClick={() => { closeDetail(); router.push(`/participants/${detail.id}`); }}
                    style={{
                      padding: "0.4rem 1rem",
                      background: "#1F6B4D",
                      color: "#fff",
                      border: "none",
                      borderRadius: "0.35rem",
                      fontWeight: 600,
                      fontSize: "0.8125rem",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      boxShadow: "0 2px 6px rgba(31,107,77,0.2)",
                    }}
                  >
                    Edit
                  </button>
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.75rem",
                }}>
                  <div style={{
                    background: "rgba(255,255,255,0.5)",
                    borderRadius: "0.5rem",
                    padding: "0.65rem 0.75rem",
                    border: "1px solid rgba(191,201,193,0.2)",
                  }}>
                    <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginBottom: "0.2rem" }}>ID</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", fontWeight: 600 }}>{detail.localParticipantId}</div>
                  </div>
                  <div style={{
                    background: "rgba(255,255,255,0.5)",
                    borderRadius: "0.5rem",
                    padding: "0.65rem 0.75rem",
                    border: "1px solid rgba(191,201,193,0.2)",
                  }}>
                    <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginBottom: "0.2rem" }}>FCP</div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{detail.fcpName} ({detail.fcpId})</div>
                  </div>
                  <div style={{
                    background: "rgba(255,255,255,0.5)",
                    borderRadius: "0.5rem",
                    padding: "0.65rem 0.75rem",
                    border: "1px solid rgba(191,201,193,0.2)",
                  }}>
                    <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginBottom: "0.2rem" }}>Community</div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{detail.communityName}</div>
                  </div>
                  <div style={{
                    background: "rgba(255,255,255,0.5)",
                    borderRadius: "0.5rem",
                    padding: "0.65rem 0.75rem",
                    border: "1px solid rgba(191,201,193,0.2)",
                  }}>
                    <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginBottom: "0.2rem" }}>Grade Level</div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{detail.gradeLevel || "\u2014"}</div>
                  </div>
                  <div style={{
                    background: "rgba(255,255,255,0.5)",
                    borderRadius: "0.5rem",
                    padding: "0.65rem 0.75rem",
                    border: "1px solid rgba(191,201,193,0.2)",
                  }}>
                    <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginBottom: "0.2rem" }}>Gender</div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{detail.gender || "\u2014"}</div>
                  </div>
                  <div style={{
                    background: "rgba(255,255,255,0.5)",
                    borderRadius: "0.5rem",
                    padding: "0.65rem 0.75rem",
                    border: "1px solid rgba(191,201,193,0.2)",
                  }}>
                    <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginBottom: "0.2rem" }}>Age</div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{detail.ageText || "\u2014"}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
