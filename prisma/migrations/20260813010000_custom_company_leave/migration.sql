-- DropForeignKey
ALTER TABLE "BulkLeaveAction" DROP CONSTRAINT "BulkLeaveAction_leaveTypeId_fkey";

-- AlterTable
ALTER TABLE "BulkLeaveAction" ALTER COLUMN "leaveTypeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "BulkLeaveAction" ADD CONSTRAINT "BulkLeaveAction_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
