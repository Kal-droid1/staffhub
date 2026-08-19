export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const SUNDAY_SCHOOL_FIRST_EXPORT_MONTH = "2026-7";

const FIRST_YEAR = 2026;
const FIRST_MONTH = 7;
const FIRST_INDEX = FIRST_YEAR * 12 + (FIRST_MONTH - 1);

export interface SundaySchoolExportMonth {
  year: number;
  month: number;
}

export interface SundaySchoolExportMonthOption {
  value: string;
  label: string;
}

export function getAddisNow(now: Date = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);

  const obj: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") obj[p.type] = p.value;
  }

  return { year: Number(obj.year), month: Number(obj.month) };
}

export function getCurrentSundaySchoolPeriod(
  now: Date = new Date()
): { year: number; month: number; week: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const obj: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") obj[p.type] = p.value;
  }

  const year = Number(obj.year);
  const month = Number(obj.month);
  const day = Number(obj.day);
  const week = Math.min(5, Math.ceil(day / 7));
  return { year, month, week };
}

export function sundaySchoolPeriodIndex(year: number, month: number, week: number): number {
  return (year * 12 + (month - 1)) * 5 + week;
}

function monthIndex(year: number, month: number): number {
  return year * 12 + (month - 1);
}

export function getSundaySchoolExportMonths(
  now: Date = new Date()
): SundaySchoolExportMonth[] {
  const current = getAddisNow(now);
  const endIndex = monthIndex(current.year, current.month) + 12;

  const months: SundaySchoolExportMonth[] = [];
  for (let i = FIRST_INDEX; i <= endIndex; i++) {
    const year = Math.floor(i / 12);
    const month = (i % 12) + 1;
    months.push({ year, month });
  }

  return months;
}

export function getSundaySchoolExportMonthOptions(
  now: Date = new Date()
): SundaySchoolExportMonthOption[] {
  return getSundaySchoolExportMonths(now).map((m) => ({
    value: `${m.year}-${m.month}`,
    label: `${MONTH_NAMES[m.month - 1]} ${m.year}`,
  }));
}

export function getCurrentSundaySchoolExportMonthValue(
  now: Date = new Date()
): string {
  const current = getAddisNow(now);
  const currentIndex = monthIndex(current.year, current.month);
  const value = `${current.year}-${current.month}`;
  return currentIndex >= FIRST_INDEX ? value : SUNDAY_SCHOOL_FIRST_EXPORT_MONTH;
}

export function isSupportedSundaySchoolExportMonth(
  year: number,
  month: number,
  now: Date = new Date()
): boolean {
  return getSundaySchoolExportMonths(now).some(
    (m) => m.year === year && m.month === month
  );
}

/**
 * Count the real number of Sundays in a calendar month.
 * Used by the export (server) and the UI labels (client) so they
 * always agree on the week count for any given month.
 */
export function countSundaysInMonth(year: number, month: number): number {
  let count = 0;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let d = 1; d <= lastDay; d++) {
    if (new Date(Date.UTC(year, month - 1, d)).getUTCDay() === 0) count++;
  }
  return count;
}
