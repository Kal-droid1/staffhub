import { requireAuth } from "@/modules/core/require-auth";
import { getTrashedStaff } from "@/lib/staff";
import TrashClient from "./trash-client";

export default async function StaffTrashPage() {
  await requireAuth("MANAGER");
  const initialTrash = await getTrashedStaff();

  return <TrashClient initialTrash={JSON.parse(JSON.stringify(initialTrash))} />;
}
