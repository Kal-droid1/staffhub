import ExcelJS from "exceljs";

const ID_HEADER_RE = /\bid\b/i;
const NAME_HEADER_RE = /\bname\b/i;
const HEADER_SCAN_ROWS = 10;

export interface RosterUploadParse {
  ids: string[];
  headerRow: number;
  idColumn: number;
  nameColumn: number;
}

function cellText(cell: ExcelJS.Cell): string {
  return (cell.text ?? "").toString().trim();
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

  const ids: string[] = [];
  const idSet = new Set<string>();

  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    if (isRowEmpty(row)) break;

    const rawId = cellText(row.getCell(idColumn));
    if (!rawId) continue;

    const normalized = rawId.toUpperCase();
    if (!idSet.has(normalized)) {
      idSet.add(normalized);
      ids.push(normalized);
    }
  }

  return { ids, headerRow, idColumn, nameColumn };
}
