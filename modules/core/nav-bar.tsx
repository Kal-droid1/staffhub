"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

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
        padding: "0.75rem 1.5rem",
        backgroundColor: "#2563eb",
        color: "white",
      }}
    >
      <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
        <Link href="/dashboard" style={{ color: "white", textDecoration: "none", fontWeight: 500 }}>
          Dashboard
        </Link>
        <Link href="/attendance" style={{ color: "white", textDecoration: "none", fontWeight: 500 }}>
          Attendance
        </Link>
        {(role === "MANAGER" || role === "ADMIN") && (
          <Link href="/approve" style={{ color: "white", textDecoration: "none", fontWeight: 500 }}>
            Approve
          </Link>
        )}
        {(role === "MANAGER" || role === "ADMIN") && (
          <Link href="/settings" style={{ color: "white", textDecoration: "none", fontWeight: 500 }}>
            Settings
          </Link>
        )}
        {(role === "MANAGER" || role === "ADMIN") && (
          <Link href="/reports" style={{ color: "white", textDecoration: "none", fontWeight: 500 }}>
            Reports
          </Link>
        )}
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        style={{
          padding: "0.25rem 0.75rem",
          backgroundColor: "rgba(255,255,255,0.2)",
          color: "white",
          border: "1px solid rgba(255,255,255,0.3)",
          borderRadius: "0.25rem",
          cursor: "pointer",
        }}
      >
        Log out
      </button>
    </nav>
  );
}
