import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import { getMonthlyReport } from "@/modules/attendance/queries";
import ExcelJS from "exceljs";

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

async function buildXlsxResponse(
  summary: Awaited<ReturnType<typeof getMonthlyReport>>["summary"],
  month: number,
  year: number
): Promise<NextResponse> {
  const workbook = new ExcelJS.Workbook();

  buildSummarySheet(workbook, summary, month, year);
  buildDetailSheet(workbook, summary);

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

function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  summary: Awaited<ReturnType<typeof getMonthlyReport>>["summary"],
  month: number,
  year: number
) {
  const sheet = workbook.addWorksheet("Summary", {
    properties: { defaultColWidth: 8 },
    views: [{ showGridLines: false }],
  });

  sheet.columns = [
    { width: 26 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
  ];

  sheet.getRow(1).height = 28;
  const titleRow = sheet.getRow(1);
  titleRow.getCell(1).value = "Harar Lutheran Child Development Program";
  applyStyle(titleRow.getCell(1), styleTitleBanner);

  sheet.getRow(2).height = 20;
  const subRow = sheet.getRow(2);
  subRow.getCell(1).value = "Monthly Attendance Summary";
  applyStyle(subRow.getCell(1), styleSubtitle);

  sheet.getRow(3).height = 18;
  const monthRow = sheet.getRow(3);
  monthRow.getCell(1).value = "Report Month:";
  applyStyle(monthRow.getCell(1), styleMonthLabel);
  monthRow.getCell(3).value = `${MONTH_NAMES[month - 1]} ${year}`;
  applyStyle(monthRow.getCell(3), styleMonthValue);

  sheet.getRow(5).height = 18;
  const headerValues = ["Staff Name", "Present", "Absent", "Leave"];
  for (let c = 0; c < headerValues.length; c++) {
    const cell = sheet.getRow(5).getCell(c + 1);
    cell.value = headerValues[c];
    applyStyle(cell, styleHeaderCell);
  }

  for (let i = 0; i < summary.length; i++) {
    const row = sheet.getRow(6 + i);
    const s = summary[i];
    const rowFill = i % 2 === 0 ? evenRowFill : oddRowFill;

    const nameCell = row.getCell(1);
    nameCell.value = s.user.name;
    applyStyle(nameCell, { ...styleDataCell, fill: rowFill });

    for (let c = 2; c <= 4; c++) {
      const cell = row.getCell(c);
      applyStyle(cell, { ...styleDataCell, fill: rowFill, alignment: styleCenterAlign });
    }

    row.getCell(2).value = s.present;
    row.getCell(3).value = s.absent;
    row.getCell(4).value = s.leave;
  }

  sheet.views = [
    { showGridLines: false, state: "frozen", ySplit: 5 },
  ];
}

function buildDetailSheet(
  workbook: ExcelJS.Workbook,
  summary: Awaited<ReturnType<typeof getMonthlyReport>>["summary"]
) {
  const sheet = workbook.addWorksheet("Daily Detail", {
    properties: { defaultColWidth: 8 },
    views: [{ showGridLines: false }],
  });

  sheet.columns = [
    { width: 18 },
    { width: 24 },
    { width: 12 },
    { width: 32 },
  ];

  sheet.getRow(1).height = 26;
  const titleCell = sheet.getRow(1).getCell(1);
  titleCell.value = "Harar Lutheran Child Development Program \u2014 Daily Attendance Detail";
  applyStyle(titleCell, styleTitleBanner);
  sheet.mergeCells(1, 1, 1, 4);

  sheet.getRow(3).height = 18;
  const detailHeaders = ["Date", "Staff Name", "Status", "Note"];
  for (let c = 0; c < detailHeaders.length; c++) {
    const cell = sheet.getRow(3).getCell(c + 1);
    cell.value = detailHeaders[c];
    applyStyle(cell, styleHeaderCell);
  }

  let dataRow = 4;
  for (const s of summary) {
    for (const r of s.records) {
      const row = sheet.getRow(dataRow);

      const dateCell = row.getCell(1);
      dateCell.value = r.date.toISOString().slice(0, 10);
      applyStyle(dateCell, styleDetailCell);

      const nameCell = row.getCell(2);
      nameCell.value = r.userName;
      applyStyle(nameCell, styleDetailCell);

      const statusCell = row.getCell(3);
      statusCell.value = r.status;
      applyStyle(statusCell, styleDetailCell);

      const noteCell = row.getCell(4);
      noteCell.value = r.note ?? "";
      applyStyle(noteCell, styleNoteCell);

      dataRow++;
    }
  }

  sheet.views = [
    { showGridLines: false, state: "frozen", ySplit: 3 },
  ];
}

const FONT_FAMILY = { name: "Times New Roman" };

const borderThin: ExcelJS.Borders = {
  top: { style: "thin", color: { argb: "FFB7B7B7" } },
  right: { style: "thin", color: { argb: "FFB7B7B7" } },
  bottom: { style: "thin", color: { argb: "FFB7B7B7" } },
  left: { style: "thin", color: { argb: "FFB7B7B7" } },
  diagonal: { style: undefined },
};

const evenRowFill: ExcelJS.Fill = {
  type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E2F3" },
};
const oddRowFill: ExcelJS.Fill = {
  type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F1" },
};

const styleTitleBanner: Partial<ExcelJS.Style> = {
  font: { ...FONT_FAMILY, bold: true, color: { argb: "FFFFFFFF" }, size: 16 },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } },
};

const styleSubtitle: Partial<ExcelJS.Style> = {
  font: { ...FONT_FAMILY, bold: true, color: { argb: "FF1F4E78" }, size: 12 },
};

const styleMonthLabel: Partial<ExcelJS.Style> = {
  font: { ...FONT_FAMILY, bold: true, size: 10 },
};

const styleMonthValue: Partial<ExcelJS.Style> = {
  font: { ...FONT_FAMILY, bold: true, color: { argb: "FF1F4E78" }, size: 10 },
};

const styleHeaderCell: Partial<ExcelJS.Style> = {
  font: { ...FONT_FAMILY, bold: true, color: { argb: "FFFFFFFF" }, size: 11 },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E75B6" } },
  border: borderThin,
};

const styleDataCell: Partial<ExcelJS.Style> = {
  font: { ...FONT_FAMILY, size: 11 },
  border: borderThin,
};

const styleDetailCell: Partial<ExcelJS.Style> = {
  font: { ...FONT_FAMILY, size: 11 },
  border: borderThin,
};

const styleNoteCell: Partial<ExcelJS.Style> = {
  font: { ...FONT_FAMILY, italic: true, color: { argb: "FF808080" }, size: 10 },
  border: borderThin,
};

const styleCenterAlign: Partial<ExcelJS.Alignment> = {
  horizontal: "center",
};

function applyStyle(cell: ExcelJS.Cell, style: Partial<ExcelJS.Style>) {
  if (style.font) cell.font = { ...cell.font, ...style.font } as ExcelJS.Font;
  if (style.fill) cell.fill = style.fill;
  if (style.border) cell.border = style.border;
  if (style.alignment) cell.alignment = style.alignment as ExcelJS.Alignment;
}
