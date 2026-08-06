import { requireAuth } from "@/modules/core/require-auth";
import { prisma } from "@/lib/prisma";
import { getLeaveBalances } from "@/modules/leave/queries";
import { getLeaveGrants } from "@/modules/leave/queries";
import StaffProfileClient from "./staff-profile-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StaffProfilePage({ params }: PageProps) {
  await requireAuth("MANAGER");
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      isActive: true,
      hideFromReports: true,
      deactivatedAt: true,
      deletedAt: true,
      createdAt: true,
    },
  });

  if (!user) {
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
    take: 200,
  });

  const grants = await getLeaveGrants(id);

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const startOfMonth = new Date(currentYear, currentMonth, 1);
  const endOfMonth = new Date(currentYear, currentMonth + 1, 1);

  let presentThisMonth = 0;
  let absentThisMonth = 0;
  let leaveThisMonth = 0;
  let pendingThisMonth = 0;

  for (const r of records) {
    if (r.date < startOfMonth || r.date >= endOfMonth) continue;
    switch (r.status) {
      case "PRESENT": presentThisMonth++; break;
      case "ABSENT": absentThisMonth++; break;
      case "PERMISSION":
      case "ANNUAL_LEAVE":
      case "OTHER": leaveThisMonth++; break;
      case "PENDING": pendingThisMonth++; break;
    }
  }

  const userJson = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
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
      monthSummary={{ present: presentThisMonth, absent: absentThisMonth, leave: leaveThisMonth, pending: pendingThisMonth }}
    />
  );
}
