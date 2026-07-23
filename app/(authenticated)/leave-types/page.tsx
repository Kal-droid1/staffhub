import { requireAuth } from "@/modules/core/require-auth";
import { getLeaveTypes } from "@/modules/leave/queries";
import LeaveTypesClient from "./leave-types-client";

export default async function LeaveTypesPage() {
  await requireAuth("MANAGER");
  const types = await getLeaveTypes();
  return <LeaveTypesClient initialTypes={JSON.parse(JSON.stringify(types))} />;
}
