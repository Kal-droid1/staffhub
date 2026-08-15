import ExcelJS from "exceljs";

const ID_HEADER_RE = /\bid\b/i;
const NAME_HEADER_RE = /\bname\b/i;
const HEADER_SCAN_ROWS = 10;

export interface RosterUploadRow {
  id: string;
  name: string;
}

export interface RosterUploadParse {
  rows: RosterUploadRow[];
  headerRow: number;
  idColumn: number;
  nameColumn: number;
}

function cellText(cell: ExcelJS.Cell): string {
  if (!cell) return "";

  try {
    const value = cell.value as unknown;

    if (value === null || value === undefined) return "";

    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value).trim();
    }

    if (typeof value === "object") {
      const obj = value as {
        text?: unknown;
        result?: unknown;
        richText?: { text?: unknown }[];
      };

      if (Array.isArray(obj.richText)) {
        return obj.richText
          .map((part) => (part?.text === null || part?.text === undefined ? "" : String(part.text)))
          .join("")
          .trim();
      }

      if (obj.text !== null && obj.text !== undefined) {
        return String(obj.text).trim();
      }

      if (obj.result !== null && obj.result !== undefined) {
        return String(obj.result).trim();
      }

      return "";
    }

    return String(value).trim();
  } catch {
    return "";
  }
}

function isRowEmpty(row: ExcelJS.Row): boolean {
  let hasValue = false;
  row.eachCell({ includeEmpty: false }, (cell) => {
    if (cellText(cell)) hasValue = true;
  });
  return !hasValue;
}

export function parseRosterUpload(sheet: ExcelJS.Worksheet): RosterUploadParse {
  let headerRow = 0;
  let idColumn = 0;
  let nameColumn = 0;

  const scanEnd = Math.min(HEADER_SCAN_ROWS, sheet.rowCount);
  for (let r = 1; r <= scanEnd; r++) {
    const row = sheet.getRow(r);
    let foundIdColumn = 0;
    let foundNameColumn = 0;

    row.eachCell({ includeEmpty: false }, (cell) => {
      const text = cellText(cell);
      if (!text) return;
      const col = Number(cell.col);
      if (!foundIdColumn && ID_HEADER_RE.test(text)) {
        foundIdColumn = col;
      }
      if (!foundNameColumn && NAME_HEADER_RE.test(text)) {
        foundNameColumn = col;
      }
    });

    if (foundIdColumn && foundNameColumn) {
      headerRow = r;
      idColumn = foundIdColumn;
      nameColumn = foundNameColumn;
      break;
    }
  }

  if (!headerRow) {
    throw new Error("Could not find a header row with ID and Name columns.");
  }

  const rows: RosterUploadRow[] = [];
  const idSet = new Set<string>();
  let hasData = false;

  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);

    if (isRowEmpty(row)) {
      if (hasData) break;
      continue;
    }

    const rawId = cellText(row.getCell(idColumn));
    if (!rawId) {
      if (hasData) break;
      continue;
    }

    hasData = true;
    const normalized = rawId.toUpperCase();
    if (!idSet.has(normalized)) {
      idSet.add(normalized);
      rows.push({
        id: normalized,
        name: cellText(row.getCell(nameColumn)),
      });
    }
  }

  return { rows, headerRow, idColumn, nameColumn };
}
