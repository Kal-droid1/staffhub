import { requireAuth } from "@/modules/core/require-auth";
import { prisma } from "@/lib/prisma";
import { getLeaveBalances } from "@/modules/leave/queries";
import { getLeaveGrants } from "@/modules/leave/queries";
import { getLeaveTypes } from "@/modules/leave/queries";
import StaffProfileClient from "./staff-profile-client";

const DOCUMENT_CATEGORIES = [
  "Marriage Certificate",
  "Number of Kids",
  "Employment Contract",
  "Job Description",
  "Education Certificate",
  "Leave Permission",
  "Statement of Commitment to Child Protection",
  "Sick Leave",
  "Other",
];

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StaffProfilePage({ params }: PageProps) {
  const viewer = await requireAuth("MANAGER");
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      jobTitleId: true,
      jobTitle: { select: { id: true, name: true } },
      isActive: true,
      isHidden: true,
      hideFromReports: true,
      deactivatedAt: true,
      deletedAt: true,
      createdAt: true,
    },
  });

  if (!user || (user.isHidden && !viewer.isHidden)) {
    return (
      <div className="page-container">
        <h1 className="page-title">Staff not found</h1>
      </div>
    );
  }

  const balances = await getLeaveBalances(id);

  const records = await prisma.attendanceRecord.findMany({
    where: { userId: id },
    include: {
      leaveType: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
    orderBy: { date: "desc" },
  });

  const grants = await getLeaveGrants(id);

  const leaveTypes = await getLeaveTypes();

  const docs = await prisma.staffDocument.findMany({
    where: { userId: id, deletedAt: null },
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true,
      category: true,
      fileName: true,
      fileUrl: true,
      uploadedAt: true,
      uploadedBy: { select: { name: true } },
    },
  });

  const documentsJson = DOCUMENT_CATEGORIES.map((category) => ({
    category,
    files: docs
      .filter((d) => d.category === category)
      .map((d) => ({
        id: d.id,
        fileName: d.fileName,
        fileUrl: d.fileUrl,
        uploadedAt: d.uploadedAt.toISOString(),
        uploadedByName: d.uploadedBy.name,
      })),
  }));

  const userJson = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    jobTitleId: user.jobTitleId,
    jobTitle: user.jobTitle ? { id: user.jobTitle.id, name: user.jobTitle.name } : null,
    isActive: user.isActive,
    hideFromReports: user.hideFromReports,
    deactivatedAt: user.deactivatedAt?.toISOString() ?? null,
    deletedAt: user.deletedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };

  const recordsJson = records.map((r) => ({
    id: r.id,
    date: r.date.toISOString(),
    signInTime: r.signInTime?.toISOString() ?? null,
    requestedStatus: r.requestedStatus,
    status: r.status,
    note: r.note,
    leaveTypeId: r.leaveTypeId,
    leaveTypeName: r.leaveType?.name ?? null,
    attachmentUrl: r.attachmentUrl,
    batchId: r.batchId,
    reviewedBy: r.reviewedBy ? { id: r.reviewedBy.id, name: r.reviewedBy.name } : null,
  }));

  const grantsJson = grants.map((g) => ({
    id: g.id,
    leaveTypeName: g.leaveType.name,
    days: g.days,
    grantedDate: g.grantedDate.toISOString(),
    note: g.note,
    expiresAt: g.expiresAt?.toISOString() ?? null,
  }));

  return (
    <StaffProfileClient
      staff={JSON.parse(JSON.stringify(userJson))}
      balances={JSON.parse(JSON.stringify(balances))}
      records={JSON.parse(JSON.stringify(recordsJson))}
      grants={JSON.parse(JSON.stringify(grantsJson))}
      documents={JSON.parse(JSON.stringify(documentsJson))}
      leaveTypes={JSON.parse(JSON.stringify(leaveTypes))}
    />
  );
}
