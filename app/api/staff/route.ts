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
} from "@/lib/staff";

function managerGuard(session: Session | null) {
  if (!session?.user?.role) return false;
  return hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER");
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!managerGuard(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const staff = await getAllStaff();
  return NextResponse.json(staff);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!managerGuard(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, email, password, role, department } = body;

  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: "name, email, password, and role are required." }, { status: 400 });
  }

  if (!["STAFF", "MANAGER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  try {
    const user = await createStaffAccount({ name, email, password, role, department });
    return NextResponse.json(user, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Email already in use." }, { status: 409 });
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
  const { id, name, email, role, department } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  try {
    const user = await updateStaffAccount(id, { name, email, role, department });
    return NextResponse.json(user);
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Email already in use." }, { status: 409 });
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
  const { id, action, hideFromReports, confirmation } = body;

  if (!id || !action) {
    return NextResponse.json({ error: "id and action are required." }, { status: 400 });
  }

  try {
    switch (action) {
      case "deactivate": {
        const hide = hideFromReports === true;
        const user = await deactivateUser(id, hide);
        return NextResponse.json(user);
      }
      case "reactivate": {
        const user = await reactivateUser(id);
        return NextResponse.json(user);
      }
      case "delete": {
        const user = await deleteUser(id);
        return NextResponse.json(user);
      }
      case "restore": {
        const user = await restoreUser(id);
        return NextResponse.json(user);
      }
      case "permanent-delete": {
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
