"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export default function NavBar() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!session) return null;

  const role = session.user?.role as string;
  const isManager = role === "MANAGER" || role === "ADMIN";

  const linkStyle: React.CSSProperties = {
    color: "white",
    textDecoration: "none",
    fontWeight: 500,
    fontSize: "0.875rem",
    padding: "0.3rem 0",
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <button
          className="navbar-hamburger"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span />
          <span />
          <span />
        </button>

        <div className={`navbar-menu${menuOpen ? " navbar-menu--open" : ""}`}>
          <div className="navbar-links">
            <Link href="/dashboard" style={linkStyle} onClick={() => setMenuOpen(false)}>
              Dashboard
            </Link>
            <Link href="/attendance" style={linkStyle} onClick={() => setMenuOpen(false)}>
              Attendance
            </Link>
            <Link href="/participants" style={linkStyle} onClick={() => setMenuOpen(false)}>
              Participants
            </Link>
            <Link href="/participants/campaigns" style={linkStyle} onClick={() => setMenuOpen(false)}>
              Campaigns
            </Link>
            <Link href="/participants/archive" style={linkStyle} onClick={() => setMenuOpen(false)}>
              Archive
            </Link>
            {isManager && (
              <Link href="/leave-types" style={linkStyle} onClick={() => setMenuOpen(false)}>
                Leave Types
              </Link>
            )}
            {isManager && (
              <Link href="/staff" style={linkStyle} onClick={() => setMenuOpen(false)}>
                Staff
              </Link>
            )}
            {isManager && (
              <Link href="/balances" style={linkStyle} onClick={() => setMenuOpen(false)}>
                Balances
              </Link>
            )}
          </div>
          <div className="navbar-links">
            <Link href="/change-password" style={linkStyle} onClick={() => setMenuOpen(false)}>
              Change Password
            </Link>
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
          </div>
        </div>
      </div>
    </nav>
  );
}
