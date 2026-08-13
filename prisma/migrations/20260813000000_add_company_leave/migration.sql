-- CreateTable
CREATE TABLE "BulkLeaveAction" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "leaveTypeId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "batchId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "affectedStaff" INTEGER NOT NULL DEFAULT 0,
    "skippedRecords" INTEGER NOT NULL DEFAULT 0,
    "insufficientStaff" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulkLeaveAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BulkLeaveAction_batchId_key" ON "BulkLeaveAction"("batchId");

-- AddForeignKey
ALTER TABLE "BulkLeaveAction" ADD CONSTRAINT "BulkLeaveAction_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkLeaveAction" ADD CONSTRAINT "BulkLeaveAction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
