-- DropIndex
DROP INDEX "SundaySchoolClassParticipant_classId_participantId_key";

-- DropIndex
DROP INDEX "SundaySchoolClassParticipant_participantId_idx";

-- CreateIndex
CREATE INDEX "SundaySchoolClassParticipant_classId_idx" ON "SundaySchoolClassParticipant"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolClassParticipant_participantId_key" ON "SundaySchoolClassParticipant"("participantId");
