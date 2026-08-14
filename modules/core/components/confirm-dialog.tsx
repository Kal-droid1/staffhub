"use client";

import type { ReactNode } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  busyLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  busyLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const confirmBg = destructive ? "#ba1a1a" : "#1F6B4D";
  const borderTop = destructive ? "#ba1a1a" : "#D9A441";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 140,
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
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "relative",
          background: "#FAF7F0",
          borderRadius: "12px",
          border: "1px solid rgba(255, 255, 255, 0.4)",
          boxShadow: "0 20px 40px rgba(31, 107, 77, 0.25)",
          borderTop: `4px solid ${borderTop}`,
          maxWidth: 440,
          width: "calc(100% - 2rem)",
          margin: "0 1rem",
          padding: "1.5rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h3 style={{ margin: 0, color: destructive ? "#ba1a1a" : "#1F6B4D", fontSize: "1.05rem", fontWeight: 700 }}>
            {title}
          </h3>
          <button
            onClick={onCancel}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.5rem", color: "#1F6B4D", lineHeight: 1, padding: "0.25rem" }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div style={{ margin: "0 0 1rem", fontSize: "0.9rem", color: "var(--color-text)" }}>
          {message}
        </div>

        <div className="flex-row gap-sm">
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{
              padding: "0.4rem 1rem",
              background: confirmBg,
              color: "#fff",
              border: "none",
              borderRadius: "0.5rem",
              fontWeight: 600,
              fontSize: "0.8125rem",
              cursor: busy ? "default" : "pointer",
              fontFamily: "inherit",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? (busyLabel ?? "Please wait…") : confirmLabel}
          </button>
          <button
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: "0.4rem 1rem",
              background: "none",
              border: "1px solid var(--color-border)",
              borderRadius: "0.5rem",
              fontWeight: 500,
              fontSize: "0.8125rem",
              cursor: busy ? "default" : "pointer",
              color: "var(--color-text)",
              fontFamily: "inherit",
            }}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
