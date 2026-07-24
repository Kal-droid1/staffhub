import { prisma } from "@/lib/prisma";

export async function getHolidaysByYear(ethiopianYear: number) {
  return prisma.holiday.findMany({
    where: { year: ethiopianYear },
    orderBy: { date: "asc" },
  });
}

export async function createHoliday(
  date: Date,
  name: string,
  year: number,
  isDefault: boolean = false
) {
  return prisma.holiday.create({
    data: { date, name, year, isDefault },
  });
}

export async function deleteHoliday(id: string) {
  return prisma.holiday.delete({ where: { id } });
}
