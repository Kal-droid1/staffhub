"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
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

export default function ParticipantsClient() {
  const router = useRouter();
  const { data: session } = useSession();
  const isManager = session?.user?.role === "MANAGER";
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
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Header + Import button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", paddingTop: "1rem" }}>
        <h1 style={{
          fontSize: "2rem",
          fontWeight: 800,
          color: "#1F6B4D",
          margin: 0,
          letterSpacing: "-0.02em",
        }}>
          Participants
        </h1>
        {isManager && (
          <a
            href="/participants/import"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.5rem 1.5rem",
              background: "#1F6B4D",
              color: "#fff",
              border: "none",
              borderRadius: "0.5rem",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
              textDecoration: "none",
              boxShadow: "0 4px 15px rgba(217,164,65,0.4)",
              fontFamily: "inherit",
            }}
          >
            Import
          </a>
        )}
      </div>

      {/* Search bar area */}
      <div
        ref={wrapperRef}
        style={{
          position: "relative",
          marginBottom: "1rem",
        }}
      >
        <form
          onSubmit={handleSearch}
          style={{
            background: "rgba(250, 247, 240, 0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.4)",
            borderRadius: "0.75rem",
            boxShadow: "0 8px 32px rgba(31, 107, 77, 0.08)",
            padding: "1rem",
          }}
        >
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={{
                display: "block",
                marginBottom: "0.35rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--color-text-muted)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}>
                Search by name or ID
              </label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Miheret or ET065400281"
                style={{
                  width: "100%",
                  padding: "0.6rem 0.75rem",
                  border: "1px solid var(--color-border)",
                  borderRadius: "0.5rem",
                  fontSize: "0.9rem",
                  fontFamily: "inherit",
                  outline: "none",
                  background: "#fff",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "0.6rem 1.5rem",
                background: "#1F6B4D",
                color: "#fff",
                border: "none",
                borderRadius: "0.5rem",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "0 2px 8px rgba(31,107,77,0.2)",
                whiteSpace: "nowrap",
              }}
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>
        </form>

        {/* Results dropdown panel */}
        {results !== null && !loading && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              marginTop: "0.5rem",
              background: "#FAF7F0",
              borderRadius: "0.75rem",
              border: "1px solid rgba(255, 255, 255, 0.6)",
              boxShadow: "0 12px 40px rgba(31, 107, 77, 0.15), 0 4px 12px rgba(0,0,0,0.08)",
              maxHeight: "45vh",
              overflowY: "auto",
              zIndex: 50,
            }}
          >
            {error && (
              <p style={{ padding: "1rem 1.5rem", margin: 0, color: "#ba1a1a", fontSize: "0.85rem" }}>{error}</p>
            )}

            {results.length === 0 && !error && (
              <p style={{ padding: "1.5rem", margin: 0, textAlign: "center", color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
                No participants found matching &ldquo;{query}&rdquo;.
              </p>
            )}

            {results.length > 0 && !error && (
              <>
                <p style={{ padding: "0.65rem 1.25rem", margin: 0, fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  {results.length} result{results.length !== 1 ? "s" : ""}
                </p>
                {results.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => router.push(`/participants/${p.id}`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.75rem 1.25rem",
                      cursor: "pointer",
                      borderTop: "1px solid rgba(191,201,193,0.15)",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(31,107,77,0.05)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1F6B4D" }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", marginTop: "0.1rem" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>{p.localParticipantId}</span>
                        <span style={{ margin: "0 0.4rem", color: "var(--color-text-light)" }}>·</span>
                        {p.communityName}
                        {p.gradeLevel && <><span style={{ margin: "0 0.4rem", color: "var(--color-text-light)" }}>·</span>Grade {p.gradeLevel}</>}
                        <span style={{ margin: "0 0.4rem", color: "var(--color-text-light)" }}>·</span>
                        {p.gender}
                        {p.ageText && <><span style={{ margin: "0 0.4rem", color: "var(--color-text-light)" }}>·</span>{p.ageText}</>}
                      </div>
                    </div>
                    <span style={{
                      display: "inline-block",
                      padding: "0.15rem 0.5rem",
                      borderRadius: "999px",
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      background: "rgba(31,107,77,0.1)",
                      color: "#1F6B4D",
                      border: "1px solid rgba(31,107,77,0.3)",
                      flexShrink: 0,
                      marginLeft: "1rem",
                    }}>
                      {p.status}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Initial state placeholder */}
      {results === null && !loading && !error && (
        <div style={{
          textAlign: "center",
          padding: "3rem 1.5rem",
          color: "var(--color-text-muted)",
          fontSize: "0.9rem",
        }}>
          Enter a name or participant ID above to search.
        </div>
      )}
    </div>
  );
}
