import { requireAuth } from "@/modules/core/require-auth";
import { getAllStaff } from "@/lib/staff";
import StaffClient from "./staff-client";

export default async function StaffPage() {
  await requireAuth("MANAGER");
  const initialStaff = await getAllStaff();

  return <StaffClient initialStaff={JSON.parse(JSON.stringify(initialStaff))} />;
}
