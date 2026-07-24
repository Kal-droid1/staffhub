import { requireAuth } from "@/modules/core/require-auth";
import { getHolidaysByYear } from "@/lib/holidays";
import { gregorianToEthiopianYear } from "@/lib/ethiopian-date";
import HolidaysClient from "./holidays-client";

export default async function HolidaysPage() {
  await requireAuth("MANAGER");
  const currentYear = gregorianToEthiopianYear(new Date());
  const initialHolidays = await getHolidaysByYear(currentYear);

  return (
    <HolidaysClient
      initialHolidays={JSON.parse(JSON.stringify(initialHolidays))}
      initialYear={currentYear}
      currentYear={currentYear}
    />
  );
}
