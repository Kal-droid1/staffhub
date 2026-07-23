import { requireAuth } from "@/modules/core/require-auth";
import { getLeaveBalanceSummary, getLeaveTypes } from "@/modules/leave/queries";
import BalancesClient from "./balances-client";

export default async function BalancesPage() {
  await requireAuth("MANAGER");
  const summary = await getLeaveBalanceSummary();
  const leaveTypes = await getLeaveTypes();
  return (
    <BalancesClient
      initialSummary={JSON.parse(JSON.stringify(summary))}
      leaveTypes={JSON.parse(JSON.stringify(leaveTypes))}
    />
  );
}
