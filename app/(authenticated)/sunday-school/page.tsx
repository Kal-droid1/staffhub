import { requireAuth } from "@/modules/core/require-auth";
import { listClasses, listTeachers } from "@/modules/sunday-school/queries";
import SundaySchoolManagerClient from "./sunday-school-manager-client";

export default async function SundaySchoolManagerPage() {
  await requireAuth("MANAGER");

  const classes = await listClasses();
  const teachers = await listTeachers();

  return (
    <SundaySchoolManagerClient
      initialClasses={JSON.parse(JSON.stringify(classes))}
      initialTeachers={JSON.parse(JSON.stringify(teachers))}
    />
  );
}
