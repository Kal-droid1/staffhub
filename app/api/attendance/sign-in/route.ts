import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { getTodayRecord, createSignIn } from "@/modules/attendance/queries";

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await getTodayRecord(session.user.id);

  if (existing) {
    return NextResponse.json(
      { error: "Already signed in today", record: existing },
      { status: 409 }
    );
  }

  const record = await createSignIn(session.user.id);

  return NextResponse.json({ record }, { status: 201 });
}
