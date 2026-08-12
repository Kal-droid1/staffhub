type StatusVariant = "present" | "absent" | "pending" | "leave" | "approved" | "rejected";

const STATUS_STYLE: Record<StatusVariant, { bg: string; text: string; border: string; shadow: string }> = {
  present:   { bg: "rgba(31,107,77,0.1)",  text: "#1F6B4D", border: "rgba(31,107,77,0.3)",  shadow: "0 0 8px rgba(31,107,77,0.15)" },
  approved:  { bg: "rgba(31,107,77,0.1)",  text: "#1F6B4D", border: "rgba(31,107,77,0.3)",  shadow: "0 0 8px rgba(31,107,77,0.15)" },
  pending:   { bg: "rgba(217,164,65,0.15)", text: "#7d5700", border: "rgba(217,164,65,0.4)", shadow: "0 0 8px rgba(217,164,65,0.2)" },
  leave:     { bg: "rgba(217,164,65,0.15)", text: "#7d5700", border: "rgba(217,164,65,0.4)", shadow: "0 0 8px rgba(217,164,65,0.2)" },
  absent:    { bg: "rgba(186,26,26,0.08)",  text: "#ba1a1a", border: "rgba(186,26,26,0.3)",  shadow: "0 0 8px rgba(186,26,26,0.12)" },
  rejected:  { bg: "rgba(186,26,26,0.08)",  text: "#ba1a1a", border: "rgba(186,26,26,0.3)",  shadow: "0 0 8px rgba(186,26,26,0.12)" },
};

const STATUS_LABEL: Record<StatusVariant, string> = {
  present: "Present",
  absent: "Absent",
  pending: "Pending",
  leave: "Leave",
  approved: "Approved",
  rejected: "Rejected",
};

interface StatusPillProps {
  status: StatusVariant;
  label?: string;
}

export default function StatusPill({ status, label }: StatusPillProps) {
  const s = STATUS_STYLE[status];
  const displayLabel = label ?? STATUS_LABEL[status];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "0.15rem 0.65rem",
        borderRadius: "999px",
        fontSize: "0.7rem",
        fontWeight: 700,
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        backgroundColor: s.bg,
        color: s.text,
        border: `1px solid ${s.border}`,
        boxShadow: s.shadow,
        whiteSpace: "nowrap",
      }}
    >
      {displayLabel}
    </span>
  );
}
