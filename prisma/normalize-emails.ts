import { PrismaClient } from "@prisma/client";

process.loadEnvFile();

const prisma = new PrismaClient();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function main() {
  console.log("\n=== Normalize user emails to lowercase ===\n");

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true },
  });

  const mixedCase = users.filter((u) => u.email !== normalizeEmail(u.email));

  if (mixedCase.length === 0) {
    console.log("All user emails are already lowercase. Nothing to do.");
    await prisma.$disconnect();
    return;
  }

  // Map lowercased email -> the first existing email that owns it, so we can
  // detect conflicts (two accounts differing only by case) and skip those.
  const lowerToExisting = new Map<string, string>();
  for (const u of users) {
    const key = normalizeEmail(u.email);
    if (!lowerToExisting.has(key)) lowerToExisting.set(key, u.email);
  }

  let updated = 0;
  let skipped = 0;

  for (const u of mixedCase) {
    const target = normalizeEmail(u.email);
    const owner = lowerToExisting.get(target);

    if (owner !== undefined && owner !== u.email) {
      console.log(`  SKIP ${u.email} -> ${target}: another account already uses ${owner}`);
      skipped++;
      continue;
    }

    await prisma.user.update({
      where: { id: u.id },
      data: { email: target },
    });
    console.log(`  OK   ${u.email} -> ${target}`);
    updated++;
  }

  console.log(`\nDone: ${updated} email(s) normalized, ${skipped} skipped due to case conflicts.`);
  if (skipped > 0) {
    console.log("Resolve conflicts manually before relying on case-insensitive login for those accounts.");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
