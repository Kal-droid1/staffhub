import { requireAuth } from "@/modules/core/require-auth";
import { getAllStaff, getTeacherOnlyStaff } from "@/lib/staff";
import { getLeaveTypes } from "@/modules/leave/queries";
import StaffClient from "./staff-client";

export default async function StaffPage() {
  const user = await requireAuth("MANAGER");
  const initialStaff = await getAllStaff(user.isHidden);
  const initialTeachers = await getTeacherOnlyStaff(user.isHidden);
  const leaveTypes = await getLeaveTypes();

  return (
    <StaffClient
      currentUserId={user.id}
      initialStaff={JSON.parse(JSON.stringify(initialStaff))}
      initialTeachers={JSON.parse(JSON.stringify(initialTeachers))}
      leaveTypes={JSON.parse(JSON.stringify(leaveTypes))}
    />
  );
}
