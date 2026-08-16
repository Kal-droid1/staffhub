import { requireAuth } from "@/modules/core/require-auth";
import {
  isUserTeacher,
  listMyClasses,
  listCoveredClassesForSubstitute,
  listTeachers,
} from "@/modules/sunday-school/queries";
import { redirect } from "next/navigation";
import { getCurrentSundaySchoolPeriod } from "@/modules/sunday-school/export-months";
import MyClassClient from "./my-class-client";

export default async function MyClassPage() {
  const user = await requireAuth();

  if (!user.isTeacher) {
    redirect("/dashboard");
  }

  const teacher = await isUserTeacher(user.id);
  if (!teacher) {
    redirect("/dashboard");
  }

  const classes = await listMyClasses(user.id);
  const { year, month, week } = getCurrentSundaySchoolPeriod();
  const coveredClasses = await listCoveredClassesForSubstitute(user.id, year, month, week);
  const teachers = await listTeachers();

  return (
    <MyClassClient
      initialClasses={JSON.parse(JSON.stringify(classes))}
      initialCoveredClasses={JSON.parse(JSON.stringify(coveredClasses))}
      initialTeachers={JSON.parse(JSON.stringify(teachers))}
      initialUserId={user.id}
      initialYear={year}
      initialMonth={month}
      initialWeek={week}
    />
  );
}
