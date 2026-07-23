-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "cutoffTime" TEXT NOT NULL DEFAULT '09:00',

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);
