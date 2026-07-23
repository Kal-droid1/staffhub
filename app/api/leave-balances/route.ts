import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import { getLeaveBalances, getLeaveBalanceSummary } from "@/modules/leave/queries";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || undefined;

  if (userId) {
    if (!hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const balances = await getLeaveBalances(userId);
    return NextResponse.json({ userId, balances });
  }

  if (hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
    const summary = await getLeaveBalanceSummary();
    return NextResponse.json(summary);
  }

  const balances = await getLeaveBalances(session.user.id);
  return NextResponse.json([{ userId: session.user.id, userName: session.user.name, balances }]);
}
