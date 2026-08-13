import { requireAuth } from "@/modules/core/require-auth";
import { getAllStaff } from "@/lib/staff";
import { getLeaveTypes } from "@/modules/leave/queries";
import StaffClient from "./staff-client";

export default async function StaffPage() {
  await requireAuth("MANAGER");
  const initialStaff = await getAllStaff();
  const leaveTypes = await getLeaveTypes();

  return (
    <StaffClient
      initialStaff={JSON.parse(JSON.stringify(initialStaff))}
      leaveTypes={JSON.parse(JSON.stringify(leaveTypes))}
    />
  );
}
