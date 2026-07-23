import { NextResponse, type NextRequest } from "next/server";
import { markAbsentForMissingUsers } from "@/modules/attendance/queries";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");

  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await markAbsentForMissingUsers();

  return NextResponse.json({ status: "ok", absentMarked: count });
}
