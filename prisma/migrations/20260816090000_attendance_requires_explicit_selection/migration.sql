-- Make Sunday School attendance require an explicit Present/Absent selection.
-- Existing rows keep their previously submitted value; new rows must set it.
ALTER TABLE "SundaySchoolAttendance" ALTER COLUMN "present" DROP DEFAULT;
ALTER TABLE "SundaySchoolAttendance" ALTER COLUMN "present" DROP NOT NULL;
