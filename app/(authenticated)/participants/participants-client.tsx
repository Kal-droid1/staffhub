"use client";

import { useSession } from "next-auth/react";

export default function ParticipantsClient() {
  const { data: session } = useSession();
  const isManager = session?.user?.role === "MANAGER";

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
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

      <p style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: "0.9rem", padding: "2rem 1rem" }}>
        Use the global search bar above to find participants.
      </p>
    </div>
  );
}
