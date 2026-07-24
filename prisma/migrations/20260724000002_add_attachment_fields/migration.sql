-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN "attachmentUrl" TEXT;

-- AlterTable
ALTER TABLE "LeaveType" ADD COLUMN "requiresAttachment" BOOLEAN NOT NULL DEFAULT false;
