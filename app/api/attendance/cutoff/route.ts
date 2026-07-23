import { NextResponse } from "next/server";
import { getAddisTime, getSecondsUntilCutoff, getSettings } from "@/modules/attendance/queries";

export async function GET() {
  const settings = await getSettings();
  const cutoffTime = settings.cutoffTime;
  const secondsUntil = getSecondsUntilCutoff(cutoffTime);
  const addisNow = getAddisTime();

  return NextResponse.json({
    cutoffTime,
    secondsUntilCutoff: secondsUntil,
    serverTime: addisNow.toISOString(),
  });
}
