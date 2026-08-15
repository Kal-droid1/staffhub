import { requireAuth } from "@/modules/core/require-auth";
import { listTrashedClasses } from "@/modules/sunday-school/queries";
import SundaySchoolTrashClient from "./trash-client";

export default async function SundaySchoolTrashPage() {
  await requireAuth("MANAGER");
  const initialTrash = await listTrashedClasses();

  return <SundaySchoolTrashClient initialTrash={JSON.parse(JSON.stringify(initialTrash))} />;
}
