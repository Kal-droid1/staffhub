type StatusVariant = "present" | "absent" | "pending" | "leave" | "approved" | "rejected";

const STATUS_MAP: Record<StatusVariant, { label: string; variant: "success" | "warning" | "danger" }> = {
  present: { label: "Present", variant: "success" },
  absent: { label: "Absent", variant: "danger" },
  pending: { label: "Pending", variant: "warning" },
  leave: { label: "Leave", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "danger" },
};

interface StatusPillProps {
  status: StatusVariant;
  label?: string;
}

export default function StatusPill({ status, label }: StatusPillProps) {
  const mapped = STATUS_MAP[status];
  const displayLabel = label ?? mapped.label;
  return <span className={`status-pill status-pill--${mapped.variant}`}>{displayLabel}</span>;
}
