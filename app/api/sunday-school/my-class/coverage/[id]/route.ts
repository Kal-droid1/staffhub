import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { isUserTeacher, deleteCoverage } from "@/modules/sunday-school/queries";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    if (!(await isUserTeacher(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteCoverage({ coverageId: id, userId: session.user.id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to cancel coverage";
    console.error("Failed to cancel coverage:", e);
    if (message === "Coverage not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
