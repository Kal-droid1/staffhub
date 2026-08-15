import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { isUserTeacher, listMyClasses } from "@/modules/sunday-school/queries";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!(await isUserTeacher(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const classes = await listMyClasses(session.user.id);
    return NextResponse.json({ classes });
  } catch (e) {
    console.error("Failed to load my classes:", e);
    return NextResponse.json({ error: "Failed to load classes" }, { status: 500 });
  }
}
