import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TEST_PASSWORD = "password123";

const testUsers = [
  {
    name: "Alice Staff",
    email: "alice@staffhub.test",
    role: Role.STAFF,
    department: "Engineering",
  },
  {
    name: "Bob Manager",
    email: "bob@staffhub.test",
    role: Role.MANAGER,
    department: "Engineering",
  },
  {
    name: "Carol Admin",
    email: "carol@staffhub.test",
    role: Role.ADMIN,
    department: null,
  },
];

async function main() {
  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 12);

  for (const user of testUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        name: user.name,
        email: user.email,
        password: hashedPassword,
        role: user.role,
        department: user.department,
      },
    });
  }

  console.log("Seed complete. Test logins:\n");
  for (const user of testUsers) {
    console.log(`  ${user.role.padEnd(7)} | ${user.email} | ${TEST_PASSWORD}`);
  }
  console.log("");

  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", cutoffTime: "09:00" },
  });
  console.log("Settings seeded: cutoffTime = 09:00\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
