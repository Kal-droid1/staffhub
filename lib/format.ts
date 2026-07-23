export function formatDays(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function formatDaysLabel(n: number): string {
  const dayLabel = n === 1 ? "day" : "days";
  return `${formatDays(n)} ${dayLabel}`;
}
