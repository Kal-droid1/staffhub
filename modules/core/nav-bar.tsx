"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";

export default function NavBar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!session) return null;

  const role = session.user?.role as string;
  const isManager = role === "MANAGER" || role === "ADMIN";

  const linkStyle: React.CSSProperties = {
    color: "#FFFFFF",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: "0.875rem",
  };

  const navItems = [
    { href: "/attendance", label: "Attendance" },
    { href: "/participants", label: "Participants" },
    ...(isManager ? [{ href: "/leave-types", label: "Leave Types" }] : []),
    ...(isManager ? [{ href: "/staff", label: "Staff" }] : []),
    ...(isManager ? [{ href: "/balances", label: "Balances" }] : []),
  ];

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Image
              src="/staffhub-logo-512.png"
              alt="StaffHub"
              width={32}
              height={32}
              style={{ borderRadius: 6, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
            />
            <span style={{ color: "white", fontWeight: 800, fontSize: "1.25rem", letterSpacing: "-0.01em", textShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>StaffHub</span>
          </div>
        </div>
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
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href === "/attendance" && pathname.startsWith("/attendance"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    ...linkStyle,
                    opacity: isActive ? 1 : 0.8,
                    borderBottom: isActive ? "2px solid #D9A441" : "2px solid transparent",
                    padding: "2px 0",
                    transition: "opacity 0.15s ease, border-color 0.15s ease",
                  }}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div className="navbar-links" style={{ gap: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className="material-symbols-outlined" style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.5rem" }}>person</span>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>User</span>
            </div>
            <Link
              href="/change-password"
              style={{ ...linkStyle, fontSize: "0.8125rem", opacity: 0.9 }}
              onClick={() => setMenuOpen(false)}
            >
              Change Password
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              style={{
                padding: "0.4rem 1rem",
                backgroundColor: "rgba(255,255,255,0.15)",
                color: "white",
                border: "none",
                borderRadius: "0.75rem",
                cursor: "pointer",
                fontSize: "0.8125rem",
                fontWeight: 700,
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
