"use client";

import { useState, useRef, useEffect } from "react";

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

export default function GlobalParticipantSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Participant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

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
  );
}
