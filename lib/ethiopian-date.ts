/**
 * Ethiopian ↔ Gregorian calendar conversion.
 *
 * Meskerem 1 falls on September 11 Gregorian, shifting to September 12
 * when (ethiopianYear + 8) is divisible by 4 (i.e. the year before a
 * Gregorian leap year). Each Ethiopian month has 30 days. Pagume (month 13)
 * has 5 days (6 in Ethiopian leap years).
 *
 * Ethiopian month order: 1=Meskerem, 2=Tikmet, 3=Hidar, 4=Tahsas,
 * 5=Tir, 6=Yekatit, 7=Megabit, 8=Miazia, 9=Ginbot, 10=Sene,
 * 11=Hamle, 12=Nehase, 13=Pagume.
 *
 * Verified spot-checks:
 *   Meskerem 1, 2019 → Sep 11, 2026
 *   Tahsas 29, 2019  → Jan 7, 2027
 *   Yekatit 23, 2019 → Mar 2, 2027
 */

function ethiopianNewYear(ethiopianYear: number): Date {
  const gregorianYear = ethiopianYear + 7;
  const day = (gregorianYear + 1) % 4 === 0 ? 12 : 11;
  return new Date(Date.UTC(gregorianYear, 8, day));
}

export function ethiopianToGregorian(
  year: number,
  month: number,
  day: number
): Date {
  const newYear = ethiopianNewYear(year);
  const offset = (month - 1) * 30 + (day - 1);
  const result = new Date(newYear);
  result.setUTCDate(result.getUTCDate() + offset);
  return result;
}

export function gregorianToEthiopianYear(gregorianDate: Date): number {
  const gregorianYear = gregorianDate.getFullYear();
  const month = gregorianDate.getMonth() + 1;
  const day = gregorianDate.getDate();

  if (month > 9 || (month === 9 && day >= 11)) {
    return gregorianYear - 7;
  }
  return gregorianYear - 8;
}

export function getDefaultHolidays(
  year: number
): { name: string; month: number; day: number }[] {
  return [
    { name: "Ethiopian New Year (Enkutatash)", month: 1, day: 1 },
    { name: "Ethiopian Christmas (Genna)", month: 4, day: 29 },
    { name: "Ethiopian Epiphany (Timket)", month: 5, day: 11 },
    { name: "Victory of Adwa", month: 6, day: 23 },
    { name: "Labour Day", month: 8, day: 23 },
    { name: "Patriots' Day", month: 8, day: 27 },
  ];
}
