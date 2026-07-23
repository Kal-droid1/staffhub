import { requireAuth } from "@/modules/core/require-auth";
import { getPendingRecords } from "@/modules/attendance/queries";
import ApproveClient from "./approve-client";

export default async function ApprovePage() {
  const user = await requireAuth("MANAGER");
  const pending = await getPendingRecords();

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

  return <ApproveClient pendingRecords={serialized} />;
}
