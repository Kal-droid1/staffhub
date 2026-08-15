import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import { listClasses, createClass } from "@/modules/sunday-school/queries";

function managerGuard(role: unknown): boolean {
  return hasRole(role as "MANAGER" | "ADMIN", "MANAGER");
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.role || !managerGuard(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const classes = await listClasses();
    return NextResponse.json({ classes });
  } catch (e) {
    console.error("Failed to load Sunday School classes:", e);
    return NextResponse.json({ error: "Failed to load classes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.role || !managerGuard(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { name, teacherId, participantIds } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }
  if (!teacherId || typeof teacherId !== "string") {
    return NextResponse.json({ error: "teacherId is required." }, { status: 400 });
  }
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    return NextResponse.json(
      { error: "participantIds must be a non-empty array." },
      { status: 400 }
    );
  }

  try {
    const classRecord = await createClass({ name, teacherId, participantIds });
    return NextResponse.json(classRecord, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create class";
    console.error("Failed to create Sunday School class:", e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
