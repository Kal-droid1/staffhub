import { requireAuth } from "@/modules/core/require-auth";
import { isUserTeacher, listMyClasses } from "@/modules/sunday-school/queries";
import { redirect } from "next/navigation";
import MyClassClient from "./my-class-client";

function getCurrentPeriod(): { year: number; month: number; week: number } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const obj: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") obj[p.type] = p.value;
  }
  const year = Number(obj.year);
  const month = Number(obj.month);
  const day = Number(obj.day);
  const week = Math.min(5, Math.ceil(day / 7));
  return { year, month, week };
}

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
  const { year, month, week } = getCurrentPeriod();

  return (
    <MyClassClient
      initialClasses={JSON.parse(JSON.stringify(classes))}
      initialYear={year}
      initialMonth={month}
      initialWeek={week}
    />
  );
}
