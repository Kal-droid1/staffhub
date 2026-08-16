import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import { buildSundaySchoolXlsx, sundaySchoolExportFileName } from "@/modules/sunday-school/report";
import {
  isSupportedSundaySchoolExportMonth,
  getSundaySchoolExportMonthOptions,
} from "@/modules/sunday-school/export-months";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.role || !hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));

  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    return NextResponse.json({ error: "Invalid year." }, { status: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid month. Must be 1-12." }, { status: 400 });
  }
  if (!isSupportedSundaySchoolExportMonth(year, month)) {
    const options = getSundaySchoolExportMonthOptions();
    const first = options[0]?.label ?? "the first supported month";
    const last = options[options.length - 1]?.label ?? "the last supported month";
    return NextResponse.json(
      { error: `Sunday School export is only available for ${first} – ${last}.` },
      { status: 400 }
    );
  }

  try {
    const buffer = await buildSundaySchoolXlsx({ year, month });
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${sundaySchoolExportFileName(year, month)}"`,
      },
    });
  } catch (e) {
    console.error("Failed to generate Sunday School export:", e);
    const message =
      e instanceof Error && (e as NodeJS.ErrnoException).code === "ENOENT"
        ? "Sunday School report template is missing. Place sunday-school-report-template.xlsx in the project root."
        : "Failed to generate export";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
