import AdmZip from "adm-zip";
import type ExcelJS from "exceljs";

export function stripCommentsFromTemplate(raw: Buffer): Buffer {
  const zip = new AdmZip(raw);

  const entries = zip.getEntries();
  for (const entry of entries) {
    if (entry.entryName.includes("comments") || entry.entryName.includes("commentsDrawing")) {
      zip.deleteFile(entry.entryName);
    }
  }

  const relsEntries = entries.filter((e) => e.entryName.endsWith(".xml.rels"));
  for (const relsEntry of relsEntries) {
    let xml = relsEntry.getData().toString("utf-8");
    xml = xml.replace(/<Relationship[^>]*comments[^>]*\/>/g, "");
    xml = xml.replace(/<Relationship[^>]*vmlDrawing[^>]*\/>/g, "");
    zip.updateFile(relsEntry.entryName, Buffer.from(xml, "utf-8"));
  }

  const ctEntry = entries.find((e) => e.entryName === "[Content_Types].xml");
  if (ctEntry) {
    let xml = ctEntry.getData().toString("utf-8");
    xml = xml.replace(/<Override[^>]*comments[^>]*\/>/g, "");
    xml = xml.replace(/<Default[^>]*vml[^>]*\/>/g, "");
    zip.updateFile(ctEntry.entryName, Buffer.from(xml, "utf-8"));
  }

  return Buffer.from(zip.toBuffer());
}

export function copyRowStyle(src: ExcelJS.Row, dst: ExcelJS.Row) {
  dst.height = src.height;

  for (let c = 1; c <= src.cellCount; c++) {
    const srcCell = src.getCell(c);
    const dstCell = dst.getCell(c);

    const srcStyle = srcCell.style as Record<string, unknown>;
    const dstStyle = dstCell.style as Record<string, unknown>;

    dstStyle.font = srcStyle.font;
    dstStyle.fill = srcStyle.fill;
    dstStyle.border = srcStyle.border;
    dstStyle.alignment = srcStyle.alignment;
    dstStyle.numFmt = srcStyle.numFmt;
  }
}

export function copyCellStyle(srcCell: ExcelJS.Cell, dstCell: ExcelJS.Cell) {
  const srcStyle = srcCell.style as Record<string, unknown>;
  const dstStyle = dstCell.style as Record<string, unknown>;
  dstStyle.font = srcStyle.font;
  dstStyle.fill = srcStyle.fill;
  dstStyle.border = srcStyle.border;
  dstStyle.alignment = srcStyle.alignment;
  dstStyle.numFmt = srcStyle.numFmt;
}

export function cloneWorksheet(
  workbook: ExcelJS.Workbook,
  source: ExcelJS.Worksheet,
  name: string
): ExcelJS.Worksheet {
  const clone = workbook.addWorksheet(name);

  for (let c = 1; c <= source.columnCount; c++) {
    const srcCol = source.getColumn(c);
    const dstCol = clone.getColumn(c);
    if (srcCol.width !== undefined) dstCol.width = srcCol.width;
    if (srcCol.hidden) dstCol.hidden = srcCol.hidden;
  }

  source.eachRow({ includeEmpty: true }, (srcRow, rowNumber) => {
    const dstRow = clone.getRow(rowNumber);
    dstRow.height = srcRow.height;

    srcRow.eachCell({ includeEmpty: true }, (srcCell, colNumber) => {
      const dstCell = dstRow.getCell(colNumber);
      dstCell.value = srcCell.value;
      copyCellStyle(srcCell, dstCell);
    });
  });

  for (const range of source.model.merges) {
    clone.mergeCells(range);
  }

  return clone;
}
