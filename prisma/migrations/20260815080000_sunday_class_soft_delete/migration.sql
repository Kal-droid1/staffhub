-- AlterTable
ALTER TABLE "SundaySchoolClass" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SundaySchoolAttendance" DROP CONSTRAINT "SundaySchoolAttendance_classId_fkey",
ALTER COLUMN "classId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "SundaySchoolAttendance" ADD CONSTRAINT "SundaySchoolAttendance_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SundaySchoolClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;
