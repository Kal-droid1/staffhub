import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const emails = [
  "alice@staffhub.test",
  "bob@staffhub.test",
  "carol@staffhub.test",
];

const YEAR = 2026;
const MONTH = 2;

async function main() {
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, name: true, email: true },
  });

  if (users.length === 0) {
    console.log("No users found. Run db:seed first.\n");
    await prisma.$disconnect();
    return;
  }

  const userIds = users.map((u) => u.id);

  const monthStart = new Date(YEAR, MONTH - 1, 1);
  const monthEnd = new Date(YEAR, MONTH, 1);

  const result = await prisma.attendanceRecord.deleteMany({
    where: {
      userId: { in: userIds },
      date: { gte: monthStart, lt: monthEnd },
    },
  });

  console.log(`  Deleted ${result.count} attendance records for February ${YEAR}.\n`);
  console.log("  Users themselves were NOT deleted.\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
