import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import { updateClass } from "@/modules/sunday-school/queries";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.role || !hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { name, teacherId, participantIds } = body;

  if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
    return NextResponse.json({ error: "name must be a non-empty string." }, { status: 400 });
  }
  if (teacherId !== undefined && typeof teacherId !== "string") {
    return NextResponse.json({ error: "teacherId must be a string." }, { status: 400 });
  }
  if (participantIds !== undefined && (!Array.isArray(participantIds) || participantIds.length === 0)) {
    return NextResponse.json(
      { error: "participantIds must be a non-empty array." },
      { status: 400 }
    );
  }

  try {
    const classRecord = await updateClass({
      id,
      name,
      teacherId,
      participantIds,
    });
    return NextResponse.json(classRecord);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update class";
    console.error("Failed to update Sunday School class:", e);
    if (message === "Class not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
