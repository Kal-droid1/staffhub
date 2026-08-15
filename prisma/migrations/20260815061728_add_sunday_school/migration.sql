-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isTeacher" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SundaySchoolClass" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SundaySchoolClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolClassParticipant" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SundaySchoolClassParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolAttendance" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SundaySchoolAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SundaySchoolClassParticipant_participantId_idx" ON "SundaySchoolClassParticipant"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolClassParticipant_classId_participantId_key" ON "SundaySchoolClassParticipant"("classId", "participantId");

-- CreateIndex
CREATE INDEX "SundaySchoolAttendance_classId_idx" ON "SundaySchoolAttendance"("classId");

-- CreateIndex
CREATE INDEX "SundaySchoolAttendance_year_month_idx" ON "SundaySchoolAttendance"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolAttendance_participantId_year_month_week_key" ON "SundaySchoolAttendance"("participantId", "year", "month", "week");

-- AddForeignKey
ALTER TABLE "SundaySchoolClass" ADD CONSTRAINT "SundaySchoolClass_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolClassParticipant" ADD CONSTRAINT "SundaySchoolClassParticipant_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SundaySchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolClassParticipant" ADD CONSTRAINT "SundaySchoolClassParticipant_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolAttendance" ADD CONSTRAINT "SundaySchoolAttendance_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolAttendance" ADD CONSTRAINT "SundaySchoolAttendance_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SundaySchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
