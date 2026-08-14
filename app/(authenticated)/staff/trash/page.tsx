import { requireAuth } from "@/modules/core/require-auth";
import { getTrashedStaff } from "@/lib/staff";
import TrashClient from "./trash-client";

export default async function StaffTrashPage() {
  const user = await requireAuth("MANAGER");
  const initialTrash = await getTrashedStaff(user.isHidden);

  return <TrashClient initialTrash={JSON.parse(JSON.stringify(initialTrash))} />;
}
