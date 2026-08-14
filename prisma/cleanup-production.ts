import { PrismaClient } from "@prisma/client";
import { del } from "@vercel/blob";

process.loadEnvFile();

const BOB_EMAIL = "bob@staffhub.test";
const EXECUTE = process.argv.includes("--execute");

const prisma = new PrismaClient();

function parseTarget(databaseUrl: string | undefined): { host: string; database: string } | null {
  if (!databaseUrl) return null;
  try {
    const u = new URL(databaseUrl);
    return { host: u.hostname, database: u.pathname.replace(/^\//, "") };
  } catch {
    return null;
  }
}

function maskUrl(databaseUrl: string | undefined): string {
  if (!databaseUrl) return "(not set)";
  try {
    const u = new URL(databaseUrl);
    if (u.password) u.password = "*****";
    return u.toString();
  } catch {
    return "(unparseable)";
  }
}

async function collectUrls() {
  const [nonBobAvatars, documents, attachments] = await Promise.all([
    prisma.user.findMany({
      where: { email: { not: BOB_EMAIL }, avatarUrl: { not: null } },
      select: { avatarUrl: true },
    }),
    prisma.staffDocument.findMany({ select: { fileUrl: true } }),
    prisma.attendanceRecord.findMany({ where: { attachmentUrl: { not: null } }, select: { attachmentUrl: true } }),
  ]);

  const urls = new Set<string>();
  for (const u of nonBobAvatars) if (u.avatarUrl) urls.add(u.avatarUrl);
  for (const d of documents) urls.add(d.fileUrl);
  for (const a of attachments) if (a.attachmentUrl) urls.add(a.attachmentUrl);

  return { avatarCount: nonBobAvatars.length, documentCount: documents.length, attachmentCount: attachments.length, urls };
}

async function deleteBlobs(urls: string[]): Promise<{ ok: number; failed: number }> {
  if (urls.length === 0) return { ok: 0, failed: 0 };

  let ok = 0;
  let failed = 0;
  const batchSize = 50;

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    try {
      await del(batch);
      ok += batch.length;
    } catch (e) {
      failed += batch.length;
      console.error(`  Blob batch ${i / batchSize + 1} failed:`, e instanceof Error ? e.message : String(e));
    }
  }

  return { ok, failed };
}

async function main() {
  const target = parseTarget(process.env.DATABASE_URL);
  console.log("\n=== StaffHub production cleanup ===");
  console.log(`Mode:        ${EXECUTE ? "EXECUTE (destructive)" : "DRY-RUN (read-only)"}`);
  console.log(`DB host:     ${target?.host ?? "(unknown)"}`);
  console.log(`DB database: ${target?.database ?? "(unknown)"}`);
  console.log(`DB URL:      ${maskUrl(process.env.DATABASE_URL)}`);
  console.log(`Blob token:  ${process.env.BLOB_READ_WRITE_TOKEN ? "set" : "NOT SET"}\n`);

  const bob = await prisma.user.findUnique({
    where: { email: BOB_EMAIL },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      password: true,
      deletedAt: true,
    },
  });

  if (!bob) {
    console.error(`FATAL: Bob Manager (${BOB_EMAIL}) not found. Aborting.\n`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const [
    userTotal,
    usersToDeleteRows,
    jobTitles,
    leaveTypes,
    leaveGrants,
    attendance,
    bulk,
    documents,
    holidays,
    participants,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
      where: { email: { not: BOB_EMAIL } },
      select: { name: true, email: true, role: true, deletedAt: true },
      orderBy: { name: "asc" },
    }),
    prisma.jobTitle.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    prisma.leaveType.count(),
    prisma.leaveGrant.count(),
    prisma.attendanceRecord.count(),
    prisma.bulkLeaveAction.count(),
    prisma.staffDocument.count(),
    prisma.holiday.count(),
    prisma.participant.count(),
  ]);

  const blob = await collectUrls();

  console.log("=== Preserve (untouched) ===");
  console.log(`  Bob Manager: ${bob.name} <${bob.email}> role=${bob.role} isActive=${bob.isActive} deleted=${bob.deletedAt ? "yes" : "no"}`);
  console.log(`  Password hash prefix: ${bob.password.slice(0, 20)}... (will NOT change)`);
  console.log(`  Job Titles: ${jobTitles.length}`);
  for (const t of jobTitles) console.log(`    - ${t.name}`);
  console.log(`  Participants: ${participants}`);
  console.log("");

  console.log("=== Delete ===");
  console.log(`  Users: ${usersToDeleteRows.length} of ${userTotal} total (Bob kept)`);
  for (const u of usersToDeleteRows) {
    const state = u.deletedAt ? " (already in trash)" : "";
    console.log(`    - ${u.name} <${u.email}> [${u.role}]${state}`);
  }
  console.log(`  Leave Types: ${leaveTypes}`);
  console.log(`  Leave Grants: ${leaveGrants}`);
  console.log(`  Attendance Records: ${attendance}`);
  console.log(`  Company Leave Actions: ${bulk}`);
  console.log(`  Staff Documents: ${documents}`);
  console.log(`  Holidays: ${holidays}`);
  console.log(`  Non-Bob avatar blobs: ${blob.avatarCount}`);
  console.log(`  Document blobs: ${blob.documentCount}`);
  console.log(`  Leave attachment blobs: ${blob.attachmentCount}`);
  console.log(`  Total unique blobs to delete: ${blob.urls.size}`);
  console.log("");

  if (!EXECUTE) {
    console.log("Dry-run complete. No changes made.");
    console.log("Run with --execute to perform the cleanup after reviewing the counts above.\n");
    await prisma.$disconnect();
    return;
  }

  console.log("Deleting database rows in FK-safe order...\n");

  const result = await prisma.$transaction([
    prisma.attendanceRecord.deleteMany({}),
    prisma.leaveGrant.deleteMany({}),
    prisma.staffDocument.deleteMany({}),
    prisma.bulkLeaveAction.deleteMany({}),
    prisma.leaveType.deleteMany({}),
    prisma.user.deleteMany({ where: { id: { not: bob.id } } }),
    prisma.holiday.deleteMany({}),
  ]);

  console.log("  Deleted rows:");
  console.log(`    AttendanceRecord: ${result[0].count}`);
  console.log(`    LeaveGrant:       ${result[1].count}`);
  console.log(`    StaffDocument:    ${result[2].count}`);
  console.log(`    BulkLeaveAction:  ${result[3].count}`);
  console.log(`    LeaveType:        ${result[4].count}`);
  console.log(`    User:             ${result[5].count}`);
  console.log(`    Holiday:          ${result[6].count}`);
  console.log("");

  console.log("Deleting Vercel Blob files...\n");
  const blobResult = await deleteBlobs(Array.from(blob.urls));
  console.log(`  Blob delete: ${blobResult.ok} deleted, ${blobResult.failed} failed`);
  console.log("");

  console.log("=== Verification ===");
  const [remainingUsers, remainingBob, remainingLeaveTypes, remainingGrants, remainingAttendance, remainingBulk, remainingDocs, remainingHolidays, remainingParticipants, remainingJobTitles] = await Promise.all([
    prisma.user.count(),
    prisma.user.findUnique({ where: { email: BOB_EMAIL }, select: { id: true, name: true, email: true, role: true, isActive: true, password: true, deletedAt: true } }),
    prisma.leaveType.count(),
    prisma.leaveGrant.count(),
    prisma.attendanceRecord.count(),
    prisma.bulkLeaveAction.count(),
    prisma.staffDocument.count(),
    prisma.holiday.count(),
    prisma.participant.count(),
    prisma.jobTitle.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);

  console.log(`  Users remaining: ${remainingUsers} (expected 1)`);
  if (remainingBob) {
    console.log(`  Bob: ${remainingBob.name} <${remainingBob.email}> role=${remainingBob.role} isActive=${remainingBob.isActive}`);
    const passwordUnchanged = remainingBob.password === bob.password;
    console.log(`  Bob password unchanged: ${passwordUnchanged ? "YES" : "NO — INVESTIGATE"}`);
  } else {
    console.log("  Bob: MISSING — INVESTIGATE");
  }
  console.log(`  Leave Types: ${remainingLeaveTypes} (expected 0)`);
  console.log(`  Leave Grants: ${remainingGrants} (expected 0)`);
  console.log(`  Attendance: ${remainingAttendance} (expected 0)`);
  console.log(`  Company Leave: ${remainingBulk} (expected 0)`);
  console.log(`  Staff Documents: ${remainingDocs} (expected 0)`);
  console.log(`  Holidays: ${remainingHolidays} (expected 0)`);
  console.log(`  Participants: ${remainingParticipants} (expected ${participants})`);
  console.log(`  Job Titles: ${remainingJobTitles.length} (expected ${jobTitles.length})`);

  const jobTitlesMatch =
    remainingJobTitles.length === jobTitles.length &&
    remainingJobTitles.every((t, i) => t.name === jobTitles[i].name);
  console.log(`  Job Titles unchanged: ${jobTitlesMatch ? "YES" : "NO — INVESTIGATE"}`);
  console.log("");

  console.log("Cleanup complete. Manual checks remaining:");
  console.log("  1. Log in as Bob with his existing password.");
  console.log("  2. Confirm Staff page shows only Bob Manager.");
  console.log("  3. Confirm Settings -> Leave Types is empty and Settings -> Job Titles is intact.");
  console.log("  4. Open Dashboard and a Staff Profile page to confirm empty states render without errors.\n");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
