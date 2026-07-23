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
  return NextResponse.json({ cutoffTime: settings.cutoffTime });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { cutoffTime } = body;

  if (!cutoffTime) {
    return NextResponse.json({ error: "Missing cutoffTime" }, { status: 400 });
  }

  try {
    const settings = await updateSettings(cutoffTime);
    return NextResponse.json({ cutoffTime: settings.cutoffTime });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid time";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
