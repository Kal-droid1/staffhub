-- AlterTable
ALTER TABLE "SundaySchoolAttendance" ADD COLUMN     "submittedById" TEXT;

-- CreateTable
CREATE TABLE "SundaySchoolCoverage" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "substituteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SundaySchoolCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolCoverageWeek" (
    "id" TEXT NOT NULL,
    "coverageId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SundaySchoolCoverageWeek_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SundaySchoolCoverage_classId_idx" ON "SundaySchoolCoverage"("classId");

-- CreateIndex
CREATE INDEX "SundaySchoolCoverage_substituteId_idx" ON "SundaySchoolCoverage"("substituteId");

-- CreateIndex
CREATE INDEX "SundaySchoolCoverageWeek_year_month_week_idx" ON "SundaySchoolCoverageWeek"("year", "month", "week");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolCoverageWeek_coverageId_year_month_week_key" ON "SundaySchoolCoverageWeek"("coverageId", "year", "month", "week");

-- AddForeignKey
ALTER TABLE "SundaySchoolAttendance" ADD CONSTRAINT "SundaySchoolAttendance_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolCoverage" ADD CONSTRAINT "SundaySchoolCoverage_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SundaySchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolCoverage" ADD CONSTRAINT "SundaySchoolCoverage_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolCoverage" ADD CONSTRAINT "SundaySchoolCoverage_substituteId_fkey" FOREIGN KEY ("substituteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolCoverageWeek" ADD CONSTRAINT "SundaySchoolCoverageWeek_coverageId_fkey" FOREIGN KEY ("coverageId") REFERENCES "SundaySchoolCoverage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

