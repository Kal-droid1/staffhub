-- AlterTable
ALTER TABLE "User" ADD COLUMN     "hideFromReports" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3);
