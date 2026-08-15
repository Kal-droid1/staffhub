const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const SUNDAY_SCHOOL_EXPORT_MONTHS = [
  { year: 2026, month: 7 },
  { year: 2026, month: 8 },
  { year: 2026, month: 9 },
  { year: 2026, month: 10 },
  { year: 2026, month: 11 },
  { year: 2026, month: 12 },
  { year: 2027, month: 1 },
  { year: 2027, month: 2 },
  { year: 2027, month: 3 },
  { year: 2027, month: 4 },
  { year: 2027, month: 5 },
  { year: 2027, month: 6 },
] as const;

export const SUNDAY_SCHOOL_EXPORT_MONTH_OPTIONS = SUNDAY_SCHOOL_EXPORT_MONTHS.map(
  (m) => ({
    value: `${m.year}-${m.month}`,
    label: `${MONTH_NAMES[m.month - 1]} ${m.year}`,
  })
);

export const SUNDAY_SCHOOL_FIRST_EXPORT_MONTH = "2026-7";

export function isSupportedSundaySchoolExportMonth(
  year: number,
  month: number
): boolean {
  return SUNDAY_SCHOOL_EXPORT_MONTHS.some(
    (m) => m.year === year && m.month === month
  );
}
