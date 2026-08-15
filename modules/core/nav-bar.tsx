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
  const [showProfilePopup, setShowProfilePopup] = useState(false);

  if (!session) return null;

  const role = session.user?.role as string;
  const isManager = role === "MANAGER";
  const isTeacher = session.user?.isTeacher === true;
  const userName = session.user?.name ?? "";
  const userRoleLabel =
    role === "MANAGER" ? "Manager" :
    "Staff";

  const linkStyle: React.CSSProperties = {
    color: "#FFFFFF",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: "0.875rem",
  };

  const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/attendance", label: "Attendance" },
    ...(isTeacher ? [{ href: "/my-class", label: "My Class" }] : []),
    ...(isManager ? [{ href: "/staff", label: "Staff" }] : []),
  ];

  return (
    <>
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
              <span style={{ width: 1, height: 24, background: "rgba(255,255,255,0.2)", alignSelf: "center" }} />
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
                const isActive = pathname === item.href || (item.href === "/attendance" && pathname.startsWith("/attendance")) || (item.href === "/my-class" && pathname.startsWith("/my-class"));
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
              <button
                onClick={() => setShowProfilePopup(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  fontFamily: "inherit",
                }}
                title="Profile picture"
              >
                {session.user?.avatarUrl ? (
                  <span style={{
                    width: 42,
                    height: 42,
                    borderRadius: "50%",
                    background: `url(/api/account/avatar) center/cover`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    border: "2px solid rgba(255,255,255,0.5)",
                    flexShrink: 0,
                  }} />
                ) : (
                  <span className="material-symbols-outlined" style={{ color: "rgba(255,255,255,0.8)", fontSize: "2.5rem" }}>person</span>
                )}
                <div>
                  <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: 700, color: "rgba(255,255,255,0.9)", lineHeight: 1.2 }}>{userName}</p>
                  <p style={{ margin: 0, fontSize: "0.65rem", fontWeight: 500, color: "rgba(255,255,255,0.55)", lineHeight: 1.2 }}>{userRoleLabel}</p>
                </div>
              </button>
              <Link
                href="/settings"
                style={{ ...linkStyle, fontSize: "0.8125rem", opacity: 0.9 }}
                onClick={() => setMenuOpen(false)}
                title="Settings"
              >
                <span className="material-symbols-outlined" style={{ fontSize: "1.25rem" }}>settings</span>
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

      {/* Profile Picture Popup */}
      {showProfilePopup && (
        <div style={{ position: "fixed", inset: 0, zIndex: 130, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} onClick={() => setShowProfilePopup(false)} />
          <div style={{ position: "relative", background: "#FAF7F0", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.4)", boxShadow: "0 20px 40px rgba(31,107,77,0.25)", borderTop: "4px solid #D9A441", maxWidth: 400, width: "calc(100% - 2rem)", margin: "0 1rem", padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, color: "#1F6B4D", fontSize: "1.05rem", fontWeight: 700 }}>Profile Picture</h3>
              <button onClick={() => setShowProfilePopup(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.5rem", color: "#1F6B4D", lineHeight: 1, padding: "0.25rem" }} aria-label="Close">✕</button>
            </div>
            <ProfilePictureUpload onClose={() => setShowProfilePopup(false)} />
          </div>
        </div>
      )}
    </>
  );
}

function ProfilePictureUpload({ onClose }: { onClose: () => void }) {
  const { data: session, update } = useSession();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saved, setSaved] = useState(() => Boolean(session?.user?.avatarUrl));
  const [justSaved, setJustSaved] = useState(false);
  const [savedVersion, setSavedVersion] = useState(0);
  const [error, setError] = useState("");

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { setError("Please select an image file."); return; }
    if (f.size > 5 * 1024 * 1024) { setError("File must be under 5MB."); return; }
    setError("");
    setFile(f);
    setSaved(false);
    setJustSaved(false);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function handleConfirm() {
    if (!file) return;
    setUploading(true); setError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/account/avatar", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || `Upload failed (${res.status}).`); setUploading(false); return; }

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setFile(null);
      setSaved(true);
      setJustSaved(true);
      setSavedVersion((v) => v + 1);
      await update();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    }
    setUploading(false);
  }

  const displayUrl = previewUrl || (saved ? `/api/account/avatar?v=${savedVersion}` : null);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: displayUrl ? `url(${displayUrl}) center/cover` : "#6b7b6f",
          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.5rem", fontWeight: 700,
          border: "3px solid #fff", boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          transition: "background 0.2s",
        }}>
          {!displayUrl && (session?.user?.name?.charAt(0)?.toUpperCase() ?? "?")}
        </div>
        <div>
          {justSaved ? (
            <p style={{ margin: "0 0 0.35rem", fontWeight: 600, fontSize: "0.9rem", color: "#1F6B4D" }}>Picture updated!</p>
          ) : previewUrl ? (
            <p style={{ margin: "0 0 0.35rem", fontWeight: 600, fontSize: "0.9rem" }}>Preview — confirm or change</p>
          ) : saved ? (
            <p style={{ margin: "0 0 0.35rem", fontWeight: 600, fontSize: "0.9rem" }}>Profile photo</p>
          ) : (
            <p style={{ margin: "0 0 0.35rem", fontWeight: 600, fontSize: "0.9rem" }}>Upload a new photo</p>
          )}
          <label style={{
            display: "inline-block", padding: "0.4rem 1rem", background: "#1F6B4D",
            color: "#fff", borderRadius: "0.35rem", fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer",
          }}>
            {uploading ? "Uploading..." : previewUrl ? "Choose a different photo" : "Choose file"}
            <input type="file" accept="image/*" style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} onChange={handleFileSelect} disabled={uploading} />
          </label>
        </div>
      </div>
      {error && <p className="form-error mb-1">{error}</p>}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
        {previewUrl && (
          <button
            onClick={handleConfirm}
            disabled={uploading}
            style={{ padding: "0.4rem 1rem", background: "#1F6B4D", color: "#fff", border: "none", borderRadius: "0.35rem", fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer", fontFamily: "inherit" }}
          >
            {uploading ? "Saving…" : "Save"}
          </button>
        )}
        <button
          onClick={onClose}
          style={{ padding: "0.4rem 1rem", background: "none", border: "1px solid var(--color-border)", borderRadius: "0.35rem", fontWeight: 500, fontSize: "0.8125rem", cursor: "pointer", fontFamily: "inherit", color: "var(--color-text)" }}
        >
          {justSaved ? "Done" : "Close"}
        </button>
      </div>
    </>
  );
}
