import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import { getSettings, updateSettings } from "@/modules/attendance/queries";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const settings = await getSettings();
  return NextResponse.json({
    cutoffTime: settings.cutoffTime,
    officeLatitude: settings.officeLatitude,
    officeLongitude: settings.officeLongitude,
    allowedRadiusMeters: settings.allowedRadiusMeters,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { cutoffTime, officeLatitude, officeLongitude, allowedRadiusMeters } = body;

  if (!cutoffTime) {
    return NextResponse.json({ error: "Missing cutoffTime" }, { status: 400 });
  }

  try {
    const settings = await updateSettings(
      cutoffTime,
      typeof officeLatitude === "number" ? officeLatitude : undefined,
      typeof officeLongitude === "number" ? officeLongitude : undefined,
      typeof allowedRadiusMeters === "number" ? allowedRadiusMeters : undefined
    );
    return NextResponse.json({
      cutoffTime: settings.cutoffTime,
      officeLatitude: settings.officeLatitude,
      officeLongitude: settings.officeLongitude,
      allowedRadiusMeters: settings.allowedRadiusMeters,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid time";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
