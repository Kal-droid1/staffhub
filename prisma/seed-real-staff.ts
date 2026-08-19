import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { normalizeEmail } from "../lib/email";
import { normalizeUsername } from "../lib/username";

const prisma = new PrismaClient();
const TEST_PASSWORD = "password123";

/**
 * Recreates the real staff accounts after a database reset.
 * Roles assigned based on the original seed profile comments.
 */
const staff = [
  // Managers
  { name: "Nitsuhwork Aragaw", email: "nitsuhwork@staffhub.test", role: Role.MANAGER, department: "Management", isTeacher: false },

  // Teachers (isTeacher=true, no job title → teacher-only users)
  { name: "Belachew Seifu",    email: "belachew@staffhub.test",    role: Role.STAFF, department: "Teaching", isTeacher: true },
  { name: "Dagim Medmem",      email: "dagim@staffhub.test",       role: Role.STAFF, department: "Teaching", isTeacher: true },
  { name: "Fekede Kifle",      email: "fekede@staffhub.test",      role: Role.STAFF, department: "Teaching", isTeacher: true },
  { name: "Kassahun Alemayhu", email: "kassahun@staffhub.test",    role: Role.STAFF, department: "Teaching", isTeacher: true },
  { name: "Mikyas Mdmem",      email: "mikyas@staffhub.test",      role: Role.STAFF, department: "Teaching", isTeacher: true },
  { name: "Temesgen Wantamo",  email: "temesgen@staffhub.test",    role: Role.STAFF, department: "Teaching", isTeacher: true },
  { name: "Tewolde Kifle",     email: "tewolde@staffhub.test",     role: Role.STAFF, department: "Teaching", isTeacher: true },

  // Non-teaching staff
  { name: "Bereket Tsehay",    email: "bereket@staffhub.test",     role: Role.STAFF, department: "Operations", isTeacher: false },
  { name: "Mahider Getu",      email: "mahider@staffhub.test",     role: Role.STAFF, department: "Operations", isTeacher: false },
];

async function main() {
  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 12);

  console.log("\n  Recreating staff accounts...\n");

  for (const s of staff) {
    const email = normalizeEmail(s.email);
    const username = normalizeUsername(s.email.split("@")[0]);

    await prisma.user.upsert({
      where: { email },
      update: {
        name: s.name,
        username,
        role: s.role,
        department: s.department,
        isTeacher: s.isTeacher,
        password: hashedPassword,
      },
      create: {
        name: s.name,
        email,
        username,
        password: hashedPassword,
        role: s.role,
        department: s.department,
        isTeacher: s.isTeacher,
      },
    });

    const label = s.isTeacher ? "(teacher)" : s.role === "MANAGER" ? "(manager)" : "(staff)";
    console.log(`  ✅ ${s.name.padEnd(22)} ${label.padEnd(12)} username=${username}  password=${TEST_PASSWORD}`);
  }

  console.log("\n  All staff accounts restored.\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
