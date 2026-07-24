import { PrismaClient } from "@prisma/client";
import {
  ethiopianToGregorian,
  gregorianToEthiopianYear,
  getDefaultHolidays,
} from "../lib/ethiopian-date";

const prisma = new PrismaClient();

async function main() {
  const today = new Date();
  const currentEthYear = gregorianToEthiopianYear(today);
  const years = [currentEthYear, currentEthYear + 1];

  for (const year of years) {
    const existing = await prisma.holiday.findFirst({
      where: { year, isDefault: true },
    });

    if (existing) {
      console.log(`Holidays for Ethiopian year ${year} already seeded — skipping.`);
      continue;
    }

    const defaults = getDefaultHolidays(year);
    let count = 0;

    for (const h of defaults) {
      const gregorianDate = ethiopianToGregorian(year, h.month, h.day);

      await prisma.holiday.upsert({
        where: {
          date_name: {
            date: gregorianDate,
            name: h.name,
          },
        },
        update: {},
        create: {
          date: gregorianDate,
          name: h.name,
          year,
          isDefault: true,
        },
      });

      console.log(`  ${h.name}: ${gregorianDate.toLocaleDateString("en-CA")}`);
      count++;
    }

    console.log(`Seeded ${count} holidays for Ethiopian year ${year}.\n`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
