import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const YEAR = 2026;
const MONTH = 8;

async function main() {
  const monthStart = new Date(YEAR, MONTH - 1, 1);
  const monthEnd = new Date(YEAR, MONTH, 1);

  const staffResult = await prisma.attendanceRecord.deleteMany({
    where: { date: { gte: monthStart, lt: monthEnd } },
  });

  const ssResult = await prisma.sundaySchoolAttendance.deleteMany({
    where: { year: YEAR, month: MONTH },
  });

  console.log(`  Deleted ${staffResult.count} staff attendance records for August ${YEAR}.`);
  console.log(`  Deleted ${ssResult.count} Sunday School attendance records for August ${YEAR}.`);
  console.log("\n  Users, classes, and participants were NOT deleted.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
