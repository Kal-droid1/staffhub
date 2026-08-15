import ExcelJS from "exceljs";
import { stripCommentsFromTemplate, copyRowStyle } from "@/lib/excel-template";
import { getSundaySchoolAttendanceForExport } from "./queries";

const TEMPLATE_FILE = "sunday-school-report-template.xlsx";

interface ColumnMap {
  no: number;
  id: number;
  name: number;
  weeks: number[];
  total: number;
  headerRow: number;
  dataStart: number;
}

function findColumnByHeader(
  sheet: ExcelJS.Worksheet,
  headerRow: number,
  candidates: string[]
): number | null {
  for (let c = 1; c <= sheet.columnCount; c++) {
    const value = String(sheet.getCell(headerRow, c).value ?? "").trim().toLowerCase();
    for (const candidate of candidates) {
      if (value === candidate.toLowerCase() || value.includes(candidate.toLowerCase())) {
        return c;
      }
    }
  }
  return null;
}

function detectColumns(sheet: ExcelJS.Worksheet): ColumnMap | null {
  let headerRow = -1;
  for (let r = 1; r <= Math.min(sheet.rowCount, 20); r++) {
    const row = sheet.getRow(r);
    const values: string[] = [];
    for (let c = 1; c <= sheet.columnCount; c++) {
      values.push(String(row.getCell(c).value ?? "").trim().toLowerCase());
    }
    if (values.some((v) => v === "id" || v.startsWith("id ") || v === "participant id")) {
      headerRow = r;
      break;
    }
  }

  if (headerRow === -1) return null;

  const no = findColumnByHeader(sheet, headerRow, ["no", "no.", "#", "s/n"]) ?? 1;
  const id = findColumnByHeader(sheet, headerRow, ["id", "participant id"]) ?? 2;
  const name = findColumnByHeader(sheet, headerRow, ["name", "participant name"]) ?? 3;

  const weeks: number[] = [];
  for (let w = 1; w <= 5; w++) {
    const col = findColumnByHeader(sheet, headerRow, [`week ${w}`, `w${w}`]);
    if (col) weeks.push(col);
  }

  const total =
    findColumnByHeader(sheet, headerRow, ["total", "sum"]) ??
    Math.max(id, name, ...weeks) + 1;

  return { no, id, name, weeks, total, headerRow, dataStart: headerRow + 1 };
}

function detectFormulaStyle(sheet: ExcelJS.Worksheet, map: ColumnMap): string | null {
  const templateTotalCell = sheet.getCell(map.dataStart, map.total);
  const value = templateTotalCell.value;
  if (value && typeof value === "object" && "formula" in value) {
    return String(value.formula);
  }
  return null;
}

function formulaForRow(templateFormula: string | null, map: ColumnMap, row: number): string | null {
  if (templateFormula) {
    return templateFormula.replace(/[0-9]+/g, (match) => String(row));
  }

  if (map.weeks.length === 0) return null;
  const startCol = colLetter(map.weeks[0]);
  const endCol = colLetter(map.weeks[map.weeks.length - 1]);
  return `=SUM(${startCol}${row}:${endCol}${row})`;
}

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

export async function buildSundaySchoolXlsx(args: {
  year: number;
  month: number;
}) {
  const cleanTemplate = stripCommentsFromTemplate(TEMPLATE_FILE);

  const workbook = new ExcelJS.Workbook();
  // @ts-expect-error -- Buffer type mismatch between Node and exceljs types; works at runtime
  await workbook.xlsx.load(cleanTemplate);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error("Sunday school report template is missing a worksheet");
  }

  const map = detectColumns(sheet);
  if (!map) {
    throw new Error("Sunday school report template header row not found");
  }

  const rows = await getSundaySchoolAttendanceForExport(args);
  const templateRow = sheet.getRow(map.dataStart);
  const templateFormula = detectFormulaStyle(sheet, map);

  const templateRows = 1;
  const neededRows = Math.max(templateRows, rows.length);
  if (neededRows > templateRows) {
    for (let i = 0; i < neededRows - templateRows; i++) {
      const insertPos = map.dataStart + 1 + i;
      const newRow = sheet.insertRow(insertPos, []);
      copyRowStyle(templateRow, newRow);
    }
  }

  for (let i = 0; i < Math.max(templateRows, rows.length); i++) {
    const rowNumber = map.dataStart + i;
    const row = sheet.getRow(rowNumber);

    if (i < rows.length) {
      const entry = rows[i];
      row.getCell(map.no).value = i + 1;
      row.getCell(map.id).value = entry.localParticipantId;
      row.getCell(map.name).value = entry.name;
      for (let w = 0; w < map.weeks.length && w < 5; w++) {
        row.getCell(map.weeks[w]).value = entry.weeks[w]?.present ? 1 : 0;
      }
      const formula = formulaForRow(templateFormula, map, rowNumber);
      row.getCell(map.total).value = formula ? { formula } : 0;
    } else {
      for (let c = 1; c <= sheet.columnCount; c++) {
        row.getCell(c).value = null;
      }
    }
  }

  return workbook.xlsx.writeBuffer();
}

export function sundaySchoolExportFileName(year: number, month: number): string {
  const monthLabel = String(month).padStart(2, "0");
  return `sunday-school-attendance-${year}-${monthLabel}.xlsx`;
}
