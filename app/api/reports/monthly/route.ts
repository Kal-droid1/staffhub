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

async function buildXlsxResponse(
  summary: Awaited<ReturnType<typeof getMonthlyReport>>["summary"],
  month: number,
  year: number
): Promise<NextResponse> {
  const workbook = new ExcelJS.Workbook();
  const summarySheet = workbook.addWorksheet("Summary");
  const detailSheet = workbook.addWorksheet("Daily Detail");

  const headerFont = { bold: true };
  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE5E7EB" },
  };
  const redFont = { color: { argb: "FFDC2626" }, bold: true };

  summarySheet.columns = [
    { header: "Staff", key: "userName", width: 24 },
    { header: "Present", key: "presentCount", width: 12 },
    { header: "Absent", key: "absentCount", width: 12 },
    { header: "Leave", key: "leaveCount", width: 12 },
    { header: "Pending", key: "pendingCount", width: 12 },
  ];

  const summaryHeader = summarySheet.getRow(1);
  summaryHeader.font = headerFont;
  summaryHeader.fill = headerFill;

  for (const row of summary) {
    const dataRow = summarySheet.addRow({
      userName: row.user.name,
      presentCount: row.present,
      absentCount: row.absent,
      leaveCount: row.leave,
      pendingCount: row.pending,
    });
    if (row.absent > 0) {
      dataRow.getCell("absentCount").font = redFont;
    }
  }

  summarySheet.views = [{ state: "frozen", ySplit: 1 }];

  detailSheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Staff", key: "userName", width: 24 },
    { header: "Status", key: "status", width: 16 },
    { header: "Note", key: "note", width: 40 },
  ];

  const detailHeader = detailSheet.getRow(1);
  detailHeader.font = headerFont;
  detailHeader.fill = headerFill;

  for (const row of summary) {
    for (const r of row.records) {
      detailSheet.addRow({
        date: r.date.toISOString().slice(0, 10),
        userName: r.userName,
        status: r.status,
        note: r.note ?? "",
      });
    }
  }

  detailSheet.views = [{ state: "frozen", ySplit: 1 }];

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
