"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Card from "@/modules/core/components/card";

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
    <div className="page-container" style={{ maxWidth: 960 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 className="page-title" style={{ margin: 0 }}>Participants</h1>
        {isManager && (
          <a href="/participants/import" className="btn btn-primary" style={{ textDecoration: "none" }}>
            Import
          </a>
        )}
      </div>

      <Card style={{ marginBottom: "1.5rem" }}>
        <form onSubmit={handleSearch}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">Search by name or ID</label>
              <input
                type="text"
                className="form-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Miheret or ET065400281"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </button>
          </div>
        </form>
      </Card>

      {error && (
        <Card>
          <p className="form-error" style={{ margin: 0 }}>{error}</p>
        </Card>
      )}

      {results !== null && !loading && results.length === 0 && (
        <Card>
          <p className="text-muted text-center" style={{ padding: "1rem 0", margin: 0 }}>
            No participants found matching &ldquo;{query}&rdquo;.
          </p>
        </Card>
      )}

      {results !== null && results.length > 0 && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <p style={{ padding: "0.75rem 1.5rem", margin: 0, fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
            {results.length} result{results.length !== 1 ? "s" : ""}
          </p>
          <div className="table-responsive">
            <table className="table-card" style={{ boxShadow: "none", border: "none", borderRadius: 0 }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>ID</th>
                  <th>Grade Level</th>
                  <th>Gender</th>
                  <th>Age</th>
                  <th>Community</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/participants/${p.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <td data-label="Name" style={{ fontWeight: 600 }}>{p.name}</td>
                    <td data-label="ID" style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                      {p.localParticipantId}
                    </td>
                    <td data-label="Grade Level">{p.gradeLevel || "\u2014"}</td>
                    <td data-label="Gender">{p.gender || "\u2014"}</td>
                    <td data-label="Age">{p.ageText || "\u2014"}</td>
                    <td data-label="Community">{p.communityName}</td>
                    <td data-label="Status">
                      <span className="status-pill status-pill--success">{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {results === null && !loading && (
        <Card>
          <p className="text-muted text-center" style={{ padding: "1.5rem 0", margin: 0 }}>
            Enter a name or participant ID above to search.
          </p>
        </Card>
      )}
    </div>
  );
}
