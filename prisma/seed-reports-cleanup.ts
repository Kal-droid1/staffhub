import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const reportTestEmails = [
  "dave@staffhub.test",
  "eve@staffhub.test",
  "frank@staffhub.test",
  "grace@staffhub.test",
  "hank@staffhub.test",
];

async function main() {
  const users = await prisma.user.findMany({
    where: { email: { in: reportTestEmails } },
    select: { id: true, name: true, email: true },
  });

  if (users.length === 0) {
    console.log("No report test users found. Nothing to clean up.\n");
    await prisma.$disconnect();
    return;
  }

  const userIds = users.map((u) => u.id);

  const deletedRecords = await prisma.attendanceRecord.deleteMany({
    where: { userId: { in: userIds } },
  });
  console.log(`  Deleted ${deletedRecords.count} attendance records.`);

  const deletedUsers = await prisma.user.deleteMany({
    where: { id: { in: userIds } },
  });
  console.log(`  Deleted ${deletedUsers.count} users.`);

  for (const u of users) {
    console.log(`    - ${u.name} (${u.email})`);
  }
  console.log("\n  Cleanup complete.\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
