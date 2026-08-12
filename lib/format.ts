const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PRESENT: "Present",
  ABSENT: "Absent",
  PERMISSION: "Permission",
  ANNUAL_LEAVE: "Annual Leave",
  OTHER: "Other",
  FIELD_WORK: "Field Work",
};

export function formatAttendanceStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function formatDays(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function formatDaysLabel(n: number): string {
  const dayLabel = n === 1 ? "day" : "days";
  return `${formatDays(n)} ${dayLabel}`;
}
