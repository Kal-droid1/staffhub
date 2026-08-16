import { PrismaClient } from "@prisma/client";

process.loadEnvFile();

const prisma = new PrismaClient();

// Test/seed accounts live on the staffhub.test domain (base seed, report seed,
// export test teacher, etc.). Everything else is treated as a real account.
function isTestAccount(email: string): boolean {
  return email.toLowerCase().endsWith("@staffhub.test");
}

interface Row {
  name: string;
  username: string;
  email: string;
  role: string;
  isTeacher: boolean;
}

function pad(s: string, width: number): string {
  return s.length > width ? s : s + " ".repeat(width - s.length);
}

async function main() {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      name: true,
      username: true,
      email: true,
      role: true,
      isTeacher: true,
    },
    orderBy: { name: "asc" },
  });

  const real: Row[] = [];
  const excluded: Row[] = [];
  for (const u of users) {
    const row: Row = {
      name: u.name,
      username: u.username,
      email: u.email,
      role: u.role,
      isTeacher: u.isTeacher,
    };
    (isTestAccount(u.email) ? excluded : real).push(row);
  }

  const wantCsv = process.argv.includes("--csv");

  if (wantCsv) {
    console.log("Name,Username,Email");
    for (const r of real) {
      console.log(`${r.name},${r.username},${r.email}`);
    }
    console.error(`\nExcluded ${excluded.length} test/seed account(s) from the CSV.`);
  } else {
    const nameW = Math.max(6, ...real.map((r) => r.name.length));
    const userW = Math.max(10, ...real.map((r) => r.username.length));
    console.log(`\n=== Real accounts (${real.length}) ===`);
    console.log(`${pad("Name", nameW)}  ${pad("Username", userW)}  Email`);
    console.log("-".repeat(nameW + userW + 3 + 30));
    for (const r of real) {
      console.log(
        `${pad(r.name, nameW)}  ${pad(r.username, userW)}  ${r.email}` +
          (r.isTeacher ? "  (teacher)" : "")
      );
    }

    if (excluded.length > 0) {
      console.log(`\n=== Excluded test/seed accounts (${excluded.length}) ===`);
      for (const r of excluded) {
        console.log(`  ${r.name}  ->  ${r.username}  (${r.email})`);
      }
    }
    console.log("");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
