import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import { getMonthlyReport } from "@/modules/attendance/queries";
import { prisma } from "@/lib/prisma";
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
  const raw = readFileSync(join(process.cwd(), "staffhub-report-template-updated.xlsx"));
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
  const detailSheet = workbook.getWorksheet("Attendance Grid");
  if (!summarySheet || !detailSheet) {
    return NextResponse.json({ error: "Template sheets missing" }, { status: 500 });
  }

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: monthStart, lt: monthEnd } },
    select: { date: true },
  });
  const holidaySet = new Set(holidays.map((h) => toDateKey(h.date)));

  const monthCell = summarySheet.getCell("C3");
  monthCell.value = `${MONTH_NAMES[month - 1]} ${year}`;

  fillSummaryData(summarySheet, summary);
  fillGridData(detailSheet, summary, month, year, holidaySet);

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

function __unused_fillDetailData(
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

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getWeekdayDates(month: number, year: number): Date[] {
  const dates: Date[] = [];
  const lastDay = new Date(year, month, 0).getDate();
  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) dates.push(date);
  }
  return dates;
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function statusToMark(status: string | undefined): string | null {
  if (!status) return null;
  switch (status) {
    case "PRESENT": return "\u2713";
    case "ABSENT":  return "A";
    case "PERMISSION":
    case "ANNUAL_LEAVE":
    case "OTHER":
      return "L";
    default:
      return null;
  }
}

function isHoliday(_date: Date): boolean {
  return false;
}

function colLetter(colNum: number): string {
  return String.fromCharCode(64 + colNum);
}

function fillGridData(
  sheet: ExcelJS.Worksheet,
  summary: Awaited<ReturnType<typeof getMonthlyReport>>["summary"],
  month: number,
  year: number,
  holidaySet: Set<string>
) {
  const weekdays = getWeekdayDates(month, year);
  const DATE_COL_START = 3;
  const DATA_START = 6;
  const ROWS_PER_PERSON = 2;
  const TEMPLATE_PEOPLE = 5;
  const TEMPLATE_DATA_END = DATA_START + TEMPLATE_PEOPLE * ROWS_PER_PERSON - 1;

  sheet.getCell("C3").value = `${MONTH_NAMES[month - 1]} ${year}`;

  const lastDateCol = DATE_COL_START + weekdays.length - 1;
  const templateLastDateCol = 22;

  if (lastDateCol > templateLastDateCol) {
    for (let c = templateLastDateCol + 1; c <= lastDateCol; c++) {
      sheet.getColumn(c).width = 8;
    }
  }

  for (let i = 0; i < weekdays.length; i++) {
    const date = weekdays[i];
    const col = DATE_COL_START + i;
    sheet.getCell(5, col).value = `${date.getDate()}\n${DAY_NAMES[date.getDay()]}`;
  }

  for (let c = DATE_COL_START + weekdays.length; c <= templateLastDateCol; c++) {
    sheet.getCell(5, c).value = null;
  }

  const neededPeople = summary.length;

  if (neededPeople > TEMPLATE_PEOPLE) {
    const extraPeople = neededPeople - TEMPLATE_PEOPLE;
    const srcSignInRow = sheet.getRow(TEMPLATE_DATA_END - 1);
    const srcSignOutRow = sheet.getRow(TEMPLATE_DATA_END);

    for (let i = 0; i < extraPeople; i++) {
      const insertPos = TEMPLATE_DATA_END + 1 + i * 2;
      sheet.insertRow(insertPos, []);
      copyRowStyle(srcSignInRow, sheet.getRow(insertPos));
      sheet.insertRow(insertPos + 1, []);
      copyRowStyle(srcSignOutRow, sheet.getRow(insertPos + 1));
    }
  }

  const dataEndRow = DATA_START + neededPeople * ROWS_PER_PERSON - 1;

  for (let s = 0; s < neededPeople; s++) {
    const staffSummary = summary[s];
    const signInRow = DATA_START + s * 2;
    const signOutRow = signInRow + 1;

    try {
      sheet.unMergeCells(`A${signInRow}`, `A${signOutRow}`);
    } catch { /* not merged */ }
    sheet.getCell(`A${signInRow}`).value = staffSummary.user.name;
    sheet.getCell(`A${signOutRow}`).value = null;
    sheet.mergeCells(`A${signInRow}:A${signOutRow}`);

    sheet.getCell(signInRow, 2).value = "2:00";
    sheet.getCell(signOutRow, 2).value = "12:30";

    const statusByDate = new Map<string, string>();
    for (const r of staffSummary.records) {
      statusByDate.set(toDateKey(r.date), r.status);
    }

    for (let d = 0; d < weekdays.length; d++) {
      const date = weekdays[d];
      const col = DATE_COL_START + d;

      const dateKey = toDateKey(date);

      if (holidaySet.has(dateKey)) {
        const fill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF0F0F0" } };
        sheet.getCell(signInRow, col).style.fill = fill;
        sheet.getCell(signOutRow, col).style.fill = fill;
        continue;
      }

      const status = statusByDate.get(dateKey);
      const mark = statusToMark(status);

      sheet.getCell(signInRow, col).value = mark;
      sheet.getCell(signOutRow, col).value = mark;
    }
  }

  if (neededPeople < TEMPLATE_PEOPLE) {
    for (let s = neededPeople; s < TEMPLATE_PEOPLE; s++) {
      const signInRow = DATA_START + s * 2;
      const signOutRow = signInRow + 1;
      try {
        sheet.unMergeCells(`A${signInRow}`, `A${signOutRow}`);
      } catch { /* not merged */ }
      for (let r = signInRow; r <= signOutRow; r++) {
        sheet.getCell(r, 1).value = null;
        sheet.getCell(r, 2).value = null;
        for (let c = DATE_COL_START; c <= Math.max(templateLastDateCol, lastDateCol); c++) {
          sheet.getCell(r, c).value = null;
        }
      }
    }
  }

  const cfRange = `C${DATA_START}:${colLetter(lastDateCol)}${dataEndRow}`;
  const rawModel = (sheet as unknown as { model?: { conditionalFormattings?: Array<{ ref: string; rules: unknown[] }> } }).model;
  const cfs = rawModel?.conditionalFormattings;
  if (cfs) {
    for (const cf of cfs) {
      cf.ref = cfRange;
    }
  }
}
