import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import { get } from "@vercel/blob";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || !hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const result = await get(url, { access: "private" });
    if (!result || result.statusCode !== 200) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType,
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch file" }, { status: 500 });
  }
}
