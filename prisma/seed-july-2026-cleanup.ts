import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const YEAR = 2026;
const MONTH = 7;

async function main() {
  const monthStart = new Date(YEAR, MONTH - 1, 1);
  const monthEnd = new Date(YEAR, MONTH, 1);

  const result = await prisma.attendanceRecord.deleteMany({
    where: {
      date: { gte: monthStart, lt: monthEnd },
    },
  });

  console.log(`  Deleted ${result.count} attendance records for July ${YEAR}.\n`);
  console.log("  Users themselves were NOT deleted.\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
