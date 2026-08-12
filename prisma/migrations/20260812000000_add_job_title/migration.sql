-- CreateTable
CREATE TABLE IF NOT EXISTS "JobTitle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobTitle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "JobTitle_name_key" ON "JobTitle"("name");

-- AlterTable
DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "jobTitleId" TEXT;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_jobTitleId_fkey" FOREIGN KEY ("jobTitleId") REFERENCES "JobTitle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
