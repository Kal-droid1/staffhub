"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

const linkStyle: React.CSSProperties = {
  color: "white",
  textDecoration: "none",
  fontWeight: 500,
  fontSize: "0.875rem",
  padding: "0.3rem 0",
};

export default function NavBar() {
  const { data: session } = useSession();

  if (!session) return null;

  const role = session.user?.role as string;

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 1.5rem",
        height: 52,
        backgroundColor: "var(--color-brand)",
        color: "white",
        boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
      }}
    >
      <div style={{ display: "flex", gap: "1.75rem", alignItems: "center" }}>
        <Link href="/dashboard" style={linkStyle}>
          Dashboard
        </Link>
        <Link href="/attendance" style={linkStyle}>
          Attendance
        </Link>
        {(role === "MANAGER" || role === "ADMIN") && (
          <Link href="/leave-types" style={linkStyle}>
            Leave Types
          </Link>
        )}
        {(role === "MANAGER" || role === "ADMIN") && (
          <Link href="/holidays" style={linkStyle}>
            Holidays
          </Link>
        )}
        {(role === "MANAGER" || role === "ADMIN") && (
          <Link href="/balances" style={linkStyle}>
            Balances
          </Link>
        )}
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        style={{
          padding: "0.35rem 0.85rem",
          backgroundColor: "rgba(255,255,255,0.12)",
          color: "white",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: "var(--radius-sm)",
          cursor: "pointer",
          fontSize: "0.8rem",
          fontWeight: 500,
          fontFamily: "inherit",
        }}
      >
        Log out
      </button>
    </nav>
  );
}
