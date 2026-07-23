import { NextResponse, type NextRequest } from "next/server";
import { markAbsentForMissingUsers } from "@/modules/attendance/queries";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await markAbsentForMissingUsers();

  return NextResponse.json({ status: "ok", absentMarked: count });
}
