-- Add a submission timestamp to Sunday School attendance records.
-- This records when the teacher last explicitly submitted the week's selection.
ALTER TABLE "SundaySchoolAttendance" ADD COLUMN "submittedAt" TIMESTAMP(3);
