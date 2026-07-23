import { requireAuth } from "@/modules/core/require-auth";
import { getLeaveBalanceSummary, getLeaveTypes, getLeaveGrants } from "@/modules/leave/queries";
import BalancesClient from "./balances-client";

export default async function BalancesPage() {
  await requireAuth("MANAGER");
  const summary = await getLeaveBalanceSummary();
  const leaveTypes = await getLeaveTypes();
  const allGrants = await getLeaveGrants();
  return (
    <BalancesClient
      initialSummary={JSON.parse(JSON.stringify(summary))}
      leaveTypes={JSON.parse(JSON.stringify(leaveTypes))}
      initialGrants={JSON.parse(JSON.stringify(allGrants))}
    />
  );
}
