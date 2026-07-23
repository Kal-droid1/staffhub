import { requireAuth } from "@/modules/core/require-auth";
import { getPendingRecords } from "@/modules/attendance/queries";
import { getLeaveBalances } from "@/modules/leave/queries";
import ApproveClient from "./approve-client";

export default async function ApprovePage() {
  const user = await requireAuth("MANAGER");
  const pending = await getPendingRecords();

  const balancesMap: Record<string, ReturnType<typeof getLeaveBalances> extends Promise<infer T> ? T : never> = {};
  for (const r of pending) {
    if (!balancesMap[r.userId]) {
      balancesMap[r.userId] = await getLeaveBalances(r.userId);
    }
  }

  const serialized = pending.map((r) => ({
    id: r.id,
    date: r.date.toISOString(),
    signInTime: r.signInTime?.toISOString() ?? null,
    requestedStatus: r.requestedStatus,
    note: r.note,
    user: {
      id: r.user.id,
      name: r.user.name,
      email: r.user.email,
      department: r.user.department,
    },
  }));

  return (
    <ApproveClient
      pendingRecords={serialized}
      balances={JSON.parse(JSON.stringify(balancesMap))}
    />
  );
}
