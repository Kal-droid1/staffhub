import ExcelJS from "exceljs";
import { readFileSync } from "fs";
import { join } from "path";
import { stripCommentsFromTemplate, copyRowStyle, cloneWorksheet } from "@/lib/excel-template";
import { getSundaySchoolAttendanceForExport } from "./queries";
import { MONTH_NAMES, countSundaysInMonth } from "./export-months";

const DATA_START_ROW = 11;
const NO_COL = 5; // E
const ID_COL = 6; // F
const NAME_COL = 7; // G
const WEEK_COLS = [8, 9, 10, 11, 12]; // H, I, J, K, L
const TOTAL_COL = 13; // M
const WEEK_COUNT_ROW = 6;

const CLONE_SOURCE_YEAR = 2026;
const CLONE_SOURCE_MONTH = 7;

function colLetter(col: number): string {
  let result = "";
  let n = col;
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

function templateSheetName(year: number, month: number): string | null {
  const name = MONTH_NAMES[month - 1];
  if (year === 2026 && month >= 7 && month <= 12) {
    return `${name} ${year}`;
  }
  if (year === 2027 && month >= 1 && month <= 6) {
    if (month === 1) return "January2027";
    if (month === 2) return "Febuary 2027";
    return `${name} ${year}`;
  }
  return null;
}

function canonicalSheetName(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function resolveSundaySchoolSheet(
  workbook: ExcelJS.Workbook,
  year: number,
  month: number
): ExcelJS.Worksheet {
  const templateName = templateSheetName(year, month);
  if (templateName) {
    const existing = workbook.getWorksheet(templateName);
    if (existing) return existing;
  }

  const canonicalName = canonicalSheetName(year, month);
  const existing = workbook.getWorksheet(canonicalName);
  if (existing) return existing;

  const sourceName = templateSheetName(CLONE_SOURCE_YEAR, CLONE_SOURCE_MONTH);
  if (!sourceName) {
    throw new Error(`Sunday School template source sheet is missing.`);
  }
  const source = workbook.getWorksheet(sourceName);
  if (!source) {
    throw new Error(`Sunday School template source sheet "${sourceName}" not found.`);
  }

  const clone = cloneWorksheet(workbook, source, canonicalName);
  clone.getCell(WEEK_COUNT_ROW, WEEK_COLS[0]).value = 5;
  return clone;
}

function rowHasLabel(sheet: ExcelJS.Worksheet, row: number, label: string): boolean {
  const f = String(sheet.getCell(row, ID_COL).value ?? "");
  const g = String(sheet.getCell(row, NAME_COL).value ?? "");
  return f.includes(label) || g.includes(label);
}

function findRowByLabel(sheet: ExcelJS.Worksheet, startRow: number, label: string): number | null {
  for (let r = startRow; r <= sheet.rowCount; r++) {
    if (rowHasLabel(sheet, r, label)) return r;
  }
  return null;
}



export async function buildSundaySchoolXlsx(args: { year: number; month: number }) {
  const rawTemplate = readFileSync(join(process.cwd(), "sunday-school-report-template.xlsx"));
  const cleanTemplate = stripCommentsFromTemplate(rawTemplate);
  const workbook = new ExcelJS.Workbook();
  // @ts-expect-error -- Buffer type mismatch between Node and exceljs types; works at runtime
  await workbook.xlsx.load(cleanTemplate);

  const sheet = resolveSundaySchoolSheet(workbook, args.year, args.month);

  for (const ws of [...workbook.worksheets]) {
    if (ws.id !== sheet.id) {
      workbook.removeWorksheet(ws.id);
    }
  }

  const weekCount = countSundaysInMonth(args.year, args.month);
  const usedWeekCols = WEEK_COLS.slice(0, weekCount);
  const unusedWeekCols = WEEK_COLS.slice(weekCount);

  const originalSummaryRow = findRowByLabel(sheet, DATA_START_ROW, "Total weekly attendants");
  if (originalSummaryRow === null) {
    throw new Error(`Sunday School template sheet "${sheet.name}" is missing its summary rows.`);
  }

  const originalDataEnd = originalSummaryRow - 1;
  const originalDataCount = Math.max(0, originalDataEnd - DATA_START_ROW + 1);

  for (let r = DATA_START_ROW; r <= originalDataEnd; r++) {
    const row = sheet.getRow(r);
    for (let c = NO_COL; c <= TOTAL_COL; c++) {
      row.getCell(c).value = null;
    }
  }

  const participants = await getSundaySchoolAttendanceForExport(args);

  const extraNeeded = Math.max(0, participants.length - originalDataCount);
  for (let i = 0; i < extraNeeded; i++) {
    const insertPos = originalSummaryRow + i;
    const srcRow = sheet.getRow(DATA_START_ROW);
    const newRow = sheet.insertRow(insertPos, []);
    copyRowStyle(srcRow, newRow);
  }

  for (let i = 0; i < participants.length; i++) {
    const r = DATA_START_ROW + i;
    const row = sheet.getRow(r);
    const p = participants[i];

    row.getCell(NO_COL).value = i + 1;
    row.getCell(ID_COL).value = p.localParticipantId;
    row.getCell(NAME_COL).value = p.name;
    for (let w = 0; w < weekCount; w++) {
      row.getCell(WEEK_COLS[w]).value = p.weeks[w]?.present ? 1 : 0;
    }
    const totalTerms = usedWeekCols
      .map((c) => `${colLetter(c)}${r}`)
      .join("+");
    row.getCell(TOTAL_COL).value = {
      formula: `(${totalTerms})`,
    };
  }

  const totalParticipants = participants.length;
  const row10 = sheet.getRow(10);
  for (const c of usedWeekCols) {
    row10.getCell(c).value = totalParticipants;
  }
  for (const c of unusedWeekCols) {
    row10.getCell(c).value = null;
  }

  if (participants.length > 0) {
    const sumEnd = DATA_START_ROW + participants.length - 1;
    const summaryRow = findRowByLabel(sheet, DATA_START_ROW, "Total weekly attendants");
    if (summaryRow === null) {
      throw new Error("Failed to locate Sunday School summary rows after writing data.");
    }

    const totalRow = sheet.getRow(summaryRow);
    for (const c of usedWeekCols) {
      const letter = colLetter(c);
      totalRow.getCell(c).value = {
        formula: `SUM(${letter}${DATA_START_ROW}:${letter}${sumEnd})`,
      };
    }
    for (const c of unusedWeekCols) {
      totalRow.getCell(c).value = null;
    }

    const percentRow = findRowByLabel(sheet, summaryRow + 1, "Percentage of Weekly attendants");
    if (percentRow !== null) {
      const pRow = sheet.getRow(percentRow);
      for (const c of usedWeekCols) {
        const letter = colLetter(c);
        pRow.getCell(c).value = {
          formula: `(${letter}${summaryRow}*100/${letter}10)`,
        };
      }
      for (const c of unusedWeekCols) {
        pRow.getCell(c).value = null;
      }
    }

    const monthlyRow = findRowByLabel(sheet, summaryRow + 1, "Monthly average");
    if (monthlyRow !== null && percentRow !== null) {
      const terms = usedWeekCols
        .map((c) => `${colLetter(c)}${percentRow}`)
        .join("+");
      sheet.getCell(monthlyRow, WEEK_COLS[0]).value = {
        formula: `(${terms})/H6`,
      };
    }
  }

  return workbook.xlsx.writeBuffer();
}

export function sundaySchoolExportFileName(year: number, month: number): string {
  const monthLabel = String(month).padStart(2, "0");
  return `sunday-school-attendance-${year}-${monthLabel}.xlsx`;
}
