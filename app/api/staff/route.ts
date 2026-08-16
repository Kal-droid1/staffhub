import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import {
  getAllStaff,
  createStaffAccount,
  updateStaffAccount,
  deactivateUser,
  reactivateUser,
  deleteUser,
  restoreUser,
  permanentlyDeleteUser,
  resetUserPassword,
} from "@/lib/staff";
import { canViewUser } from "@/lib/visibility";

function managerGuard(session: Session | null) {
  if (!session?.user?.role) return false;
  return hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER");
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!managerGuard(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const staff = await getAllStaff(session?.user?.isHidden === true);
  return NextResponse.json(staff);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!managerGuard(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, username, password, role, department, jobTitleId, isTeacher } = body;

  if (!name || !username || !password || !role) {
    return NextResponse.json({ error: "name, username, password, and role are required." }, { status: 400 });
  }

  if (typeof username !== "string" || username.trim().length <= 2) {
    return NextResponse.json({ error: "Username must be at least 3 characters." }, { status: 400 });
  }

  if (!["STAFF", "MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  try {
    const user = await createStaffAccount({ name, username, password, role, department, jobTitleId, isTeacher });
    return NextResponse.json(user, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    throw e;
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!managerGuard(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { id, name, username, role, department, jobTitleId, isTeacher } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  if (username !== undefined && (typeof username !== "string" || username.trim().length <= 2)) {
    return NextResponse.json({ error: "Username must be at least 3 characters." }, { status: 400 });
  }

  if (!(await canViewUser(session?.user?.isHidden === true, id))) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  try {
    const user = await updateStaffAccount(id, { name, username, role, department, jobTitleId, isTeacher });
    return NextResponse.json(user);
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    if ((e as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    throw e;
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!managerGuard(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { id, action, hideFromReports, confirmation, newPassword } = body;

  if (!id || !action) {
    return NextResponse.json({ error: "id and action are required." }, { status: 400 });
  }

  if (!session?.user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!(await canViewUser(session.user.isHidden === true, id))) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  try {
    switch (action) {
      case "reset-password": {
        if (!newPassword || typeof newPassword !== "string") {
          return NextResponse.json({ error: "newPassword is required." }, { status: 400 });
        }
        if (newPassword.length < 8) {
          return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
        }
        return NextResponse.json(await resetUserPassword(id, newPassword));
      }
      case "deactivate": {
        if (session.user.id === id) {
          return NextResponse.json({ error: "You cannot deactivate your own account." }, { status: 400 });
        }
        const hide = hideFromReports === true;
        const user = await deactivateUser(id, hide);
        return NextResponse.json(user);
      }
      case "reactivate": {
        const user = await reactivateUser(id);
        return NextResponse.json(user);
      }
      case "delete": {
        if (session.user.id === id) {
          return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
        }
        const user = await deleteUser(id);
        return NextResponse.json(user);
      }
      case "restore": {
        const user = await restoreUser(id);
        return NextResponse.json(user);
      }
      case "permanent-delete": {
        if (session.user.id === id) {
          return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
        }
        if (confirmation !== "DELETE") {
          return NextResponse.json({ error: "Type DELETE to confirm permanent removal." }, { status: 400 });
        }
        await permanentlyDeleteUser(id);
        return NextResponse.json({ success: true });
      }
      default:
        return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    throw e;
  }
}
