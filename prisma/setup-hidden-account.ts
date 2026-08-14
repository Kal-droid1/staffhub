import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

process.loadEnvFile();

const BOB_EMAIL = "bob@staffhub.test";
const MANAGER_EMAIL = "manager@gmail.com";
const MANAGER_PASSWORD = "Password123!";

const prisma = new PrismaClient();

async function main() {
  console.log("\n=== Setup hidden account ===");

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false;`
  );
  console.log('Ensured "User"."isHidden" column exists.');

  const bobBefore = await prisma.user.findUnique({
    where: { email: BOB_EMAIL },
    select: { id: true, password: true, role: true },
  });

  if (!bobBefore) {
    console.error(`FATAL: Bob (${BOB_EMAIL}) not found. Aborting.`);
    await prisma.$disconnect();
    process.exit(1);
  }

  await prisma.user.update({
    where: { email: BOB_EMAIL },
    data: { isHidden: true },
  });

  const bobAfter = await prisma.user.findUnique({
    where: { email: BOB_EMAIL },
    select: { id: true, name: true, email: true, role: true, isHidden: true, isActive: true, password: true },
  });

  console.log("\n=== Bob (hidden) ===");
  console.log(`  ${bobAfter?.name} <${bobAfter?.email}> role=${bobAfter?.role} isHidden=${bobAfter?.isHidden} isActive=${bobAfter?.isActive}`);
  console.log(`  Password unchanged: ${bobBefore.password === bobAfter?.password ? "YES" : "NO — INVESTIGATE"}`);

  const managerPassword = await bcrypt.hash(MANAGER_PASSWORD, 12);

  const manager = await prisma.user.upsert({
    where: { email: MANAGER_EMAIL },
    update: { name: "New Manager", role: "MANAGER", isHidden: false, isActive: true, deletedAt: null, deactivatedAt: null, hideFromReports: false },
    create: {
      name: "New Manager",
      email: MANAGER_EMAIL,
      password: managerPassword,
      role: "MANAGER",
      isHidden: false,
    },
    select: { id: true, name: true, email: true, role: true, isHidden: true, isActive: true },
  });

  console.log("\n=== New manager (visible) ===");
  console.log(`  ${manager.name} <${manager.email}> role=${manager.role} isHidden=${manager.isHidden} isActive=${manager.isActive}`);
  console.log(`  Password: ${MANAGER_PASSWORD}`);

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { name: true, email: true, role: true, isHidden: true, isActive: true, deletedAt: true },
  });

  console.log("\n=== All users ===");
  for (const u of users) {
    console.log(`  ${u.name} <${u.email}> role=${u.role} isHidden=${u.isHidden} isActive=${u.isActive} deleted=${u.deletedAt ? "yes" : "no"}`);
  }

  console.log("\nSetup complete.\n");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
