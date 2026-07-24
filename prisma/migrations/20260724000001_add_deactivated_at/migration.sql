ALTER TABLE "User" ADD COLUMN "deactivatedAt" TIMESTAMP(3);

-- Set deactivatedAt to updatedAt for any already-deactivated accounts
UPDATE "User" SET "deactivatedAt" = "updatedAt" WHERE "isActive" = false;
