import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import { getMonthlyReport } from "@/modules/attendance/queries";
import ExcelJS from "exceljs";
import AdmZip from "adm-zip";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.role || !hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const monthStr = searchParams.get("month");
  const yearStr = searchParams.get("year");
  const userId = searchParams.get("userId") || undefined;
  const format = searchParams.get("format") || "json";

  const month = Number(monthStr);
  const year = Number(yearStr);

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid month. Must be 1-12." }, { status: 400 });
  }
  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    return NextResponse.json({ error: "Invalid year." }, { status: 400 });
  }

  const { summary } = await getMonthlyReport(month, year, userId);

  if (format === "xlsx") {
    return buildXlsxResponse(summary, month, year);
  }

  const staff = summary.map((s) => ({
    id: s.user.id,
    name: s.user.name,
    email: s.user.email,
    department: s.user.department,
  }));

  const summaryJson = summary.map((s) => ({
    userName: s.user.name,
    presentCount: s.present,
    absentCount: s.absent,
    leaveCount: s.leave,
    pendingCount: s.pending,
  }));

  return NextResponse.json({ summary: summaryJson, staff });
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function stripCommentsFromTemplate(): Buffer {
  const raw = readFileSync(join(process.cwd(), "staffhub-report-template.xlsx"));
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

async function buildXlsxResponse(
  summary: Awaited<ReturnType<typeof getMonthlyReport>>["summary"],
  month: number,
  year: number
): Promise<NextResponse> {
  const cleanTemplate = stripCommentsFromTemplate();

  const workbook = new ExcelJS.Workbook();
  // @ts-expect-error -- Buffer type mismatch between Node v24 and exceljs types; works at runtime
  await workbook.xlsx.load(cleanTemplate);

  const summarySheet = workbook.getWorksheet("Summary");
  const detailSheet = workbook.getWorksheet("Daily Detail");
  if (!summarySheet || !detailSheet) {
    return NextResponse.json({ error: "Template sheets missing" }, { status: 500 });
  }

  const monthCell = summarySheet.getCell("C3");
  monthCell.value = `${MONTH_NAMES[month - 1]} ${year}`;

  fillSummaryData(summarySheet, summary);
  fillDetailData(detailSheet, summary);

  const buffer = await workbook.xlsx.writeBuffer();

  const monthLabel = String(month).padStart(2, "0");
  const filename = `staffhub-attendance-${year}-${monthLabel}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function fillSummaryData(
  sheet: ExcelJS.Worksheet,
  summary: Awaited<ReturnType<typeof getMonthlyReport>>["summary"]
) {
  const DATA_START = 6;
  const TEMPLATE_ROWS = 5;
  const neededRows = Math.max(TEMPLATE_ROWS, summary.length);
  const extraNeeded = neededRows - TEMPLATE_ROWS;

  if (extraNeeded > 0) {
    for (let i = 0; i < extraNeeded; i++) {
      const srcRow = sheet.getRow(DATA_START + TEMPLATE_ROWS - 1);
      const newRow = sheet.insertRow(DATA_START + TEMPLATE_ROWS + i, []);
      copyRowStyle(srcRow, newRow);
    }
  }

  for (let i = 0; i < Math.max(TEMPLATE_ROWS, summary.length); i++) {
    const rowNumber = DATA_START + i;
    const row = sheet.getRow(rowNumber);

    const nameCell = row.getCell(1);
    const presentCell = row.getCell(2);
    const absentCell = row.getCell(3);
    const leaveCell = row.getCell(4);

    if (i < summary.length) {
      const s = summary[i];
      nameCell.value = s.user.name;
      presentCell.value = s.present;
      absentCell.value = s.absent;
      leaveCell.value = s.leave;
    } else {
      nameCell.value = null;
      presentCell.value = null;
      absentCell.value = null;
      leaveCell.value = null;
    }
  }
}

function copyRowStyle(src: ExcelJS.Row, dst: ExcelJS.Row) {
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

function fillDetailData(
  sheet: ExcelJS.Worksheet,
  summary: Awaited<ReturnType<typeof getMonthlyReport>>["summary"]
) {
  const allRecords: { date: string; userName: string; status: string; note: string }[] = [];
  for (const s of summary) {
    for (const r of s.records) {
      allRecords.push({
        date: r.date.toISOString().slice(0, 10),
        userName: r.userName,
        status: r.status,
        note: r.note ?? "",
      });
    }
  }

  const DATA_START = 4;
  const TEMPLATE_ROWS = 1;
  const neededRows = Math.max(TEMPLATE_ROWS, allRecords.length);
  const extraNeeded = neededRows - TEMPLATE_ROWS;

  if (extraNeeded > 0) {
    const srcRow = sheet.getRow(DATA_START);
    for (let i = 0; i < extraNeeded; i++) {
      const newRow = sheet.insertRow(DATA_START + 1 + i, []);
      copyRowStyle(srcRow, newRow);
    }
  }

  for (let i = 0; i < Math.max(TEMPLATE_ROWS, allRecords.length); i++) {
    const rowNumber = DATA_START + i;
    const row = sheet.getRow(rowNumber);

    if (i < allRecords.length) {
      const r = allRecords[i];
      row.getCell(1).value = r.date;
      row.getCell(2).value = r.userName;
      row.getCell(3).value = r.status;
      row.getCell(4).value = r.note;
    } else {
      row.getCell(1).value = null;
      row.getCell(2).value = null;
      row.getCell(3).value = null;
      row.getCell(4).value = null;
    }
  }
}
