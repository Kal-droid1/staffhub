import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import { getTrashedStaff } from "@/lib/staff";

function managerGuard(session: Session | null) {
  if (!session?.user?.role) return false;
  return hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER");
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!managerGuard(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const staff = await getTrashedStaff();
  return NextResponse.json(staff);
}
