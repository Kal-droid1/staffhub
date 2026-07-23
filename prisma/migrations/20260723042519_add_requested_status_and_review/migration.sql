-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "note" TEXT,
ADD COLUMN     "requestedStatus" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
