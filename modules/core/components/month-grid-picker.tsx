"use client";

import { useMemo, useState } from "react";
import {
  SUNDAY_SCHOOL_FIRST_EXPORT_MONTH,
  getSundaySchoolExportMonthOptions,
} from "@/modules/sunday-school/export-months";

const TEAL = "#1F6B4D";
const MUTED = "#6B7280";
const BORDER = "#E8E3D9";
const TEXT = "#2B2B2B";

interface MonthGridPickerProps {
  /** Selected month as "YYYY-M", e.g. "2026-8". */
  value: string;
  onChange: (year: number, month: number) => void;
}

export default function MonthGridPicker({ value, onChange }: MonthGridPickerProps) {
  const [open, setOpen] = useState(false);
  const monthOptions = useMemo(() => getSundaySchoolExportMonthOptions(), []);

  const safeValue = monthOptions.some((o) => o.value === value)
    ? value
    : SUNDAY_SCHOOL_FIRST_EXPORT_MONTH;

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: "100%",
          minHeight: 48,
          padding: "0 0.75rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          fontSize: "0.95rem",
          fontWeight: 700,
          fontFamily: "inherit",
          color: TEXT,
          background: "#FFFFFF",
          border: `1px solid ${open ? TEAL : BORDER}`,
          borderRadius: "0.6rem",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span>{monthOptions.find((o) => o.value === safeValue)?.label ?? safeValue}</span>
        <span
          className="material-symbols-outlined"
          style={{ color: MUTED, fontSize: "1.25rem", transition: "transform 0.15s ease" }}
        >
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 130, background: "rgba(0,0,0,0.25)" }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-label="Choose month"
            style={{
              position: "absolute",
              top: "calc(100% + 0.35rem)",
              left: 0,
              right: 0,
              zIndex: 131,
              background: "#FFFFFF",
              border: `1px solid ${BORDER}`,
              borderRadius: "0.9rem",
              boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
              padding: "0.75rem",
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "0.45rem",
              maxHeight: "60vh",
              overflowY: "auto",
            }}
          >
            {monthOptions.map((o) => {
              const selected = o.value === safeValue;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    const [y, m] = o.value.split("-").map(Number);
                    onChange(y, m);
                    setOpen(false);
                  }}
                  style={{
                    minHeight: 40,
                    padding: "0 0.35rem",
                    borderRadius: "0.55rem",
                    border: selected ? "2px solid #1F6B4D" : `1px solid ${BORDER}`,
                    background: selected ? TEAL : "#FFFFFF",
                    color: selected ? "#FFFFFF" : TEXT,
                    fontWeight: selected ? 800 : 600,
                    fontSize: "0.75rem",
                    fontFamily: "inherit",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.25rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  {o.label.split(" ")[0]}
                  <span style={{ opacity: selected ? 0.85 : 0.55, fontSize: "0.68rem" }}>
                    {o.label.split(" ")[1]}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
