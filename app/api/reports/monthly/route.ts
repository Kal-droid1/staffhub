import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import { getMonthlyReport } from "@/modules/attendance/queries";

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

  if (format === "csv") {
    return buildCsvResponse(summary, month, year);
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

function buildCsvResponse(
  summary: Awaited<ReturnType<typeof getMonthlyReport>>["summary"],
  month: number,
  year: number
): NextResponse {
  const csvRows: string[] = [];

  csvRows.push("userName,presentCount,absentCount,leaveCount,pendingCount");
  for (const row of summary) {
    csvRows.push(
      `${escapeCsv(row.user.name)},${row.present},${row.absent},${row.leave},${row.pending}`
    );
  }

  csvRows.push("");
  csvRows.push("--- Daily Detail ---");
  csvRows.push("date,userName,status,note");

  for (const row of summary) {
    for (const r of row.records) {
      const dateStr = r.date.toISOString().slice(0, 10);
      csvRows.push(
        `${dateStr},${escapeCsv(r.userName)},${r.status},${escapeCsv(r.note ?? "")}`
      );
    }
  }

  const csv = csvRows.join("\n");

  const monthLabel = String(month).padStart(2, "0");
  const filename = `staffhub-attendance-${year}-${monthLabel}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
