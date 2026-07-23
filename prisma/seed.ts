import { PrismaClient, Role, AttendanceStatus } from "@prisma/client";
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

  const defaultLeaveTypes: { name: string; isAnnualRecurring: boolean; mappedStatus: AttendanceStatus }[] = [
    { name: "Annual Leave", isAnnualRecurring: true, mappedStatus: "ANNUAL_LEAVE" },
    { name: "Permission", isAnnualRecurring: false, mappedStatus: "PERMISSION" },
    { name: "Other", isAnnualRecurring: false, mappedStatus: "OTHER" },
  ];

  for (const lt of defaultLeaveTypes) {
    await prisma.leaveType.upsert({
      where: { name: lt.name },
      update: {},
      create: { name: lt.name, isAnnualRecurring: lt.isAnnualRecurring, mappedStatus: lt.mappedStatus },
    });
  }
  console.log("Leave types seeded: Annual Leave, Permission, Other\n");

  const allUsers = await prisma.user.findMany({ select: { id: true, name: true } });
  const annualType = await prisma.leaveType.findUnique({ where: { name: "Annual Leave" } });

  if (annualType) {
    for (const u of allUsers) {
      const existingGrant = await prisma.leaveGrant.findFirst({
        where: { userId: u.id, leaveTypeId: annualType.id },
      });
      if (!existingGrant) {
        await prisma.leaveGrant.create({
          data: {
            userId: u.id,
            leaveTypeId: annualType.id,
            days: 20,
            grantedDate: new Date(2026, 0, 1),
            note: "Initial 2026 annual leave",
            expiresAt: new Date(2028, 0, 1),
          },
        });
        console.log(`  ${u.name}: 20 days Annual Leave granted.`);
      }
    }
    console.log("");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
