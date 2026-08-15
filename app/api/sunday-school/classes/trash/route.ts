import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import { listTrashedClasses } from "@/modules/sunday-school/queries";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.role || !hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const classes = await listTrashedClasses();
  return NextResponse.json(classes);
}
