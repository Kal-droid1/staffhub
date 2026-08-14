import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import { prisma } from "@/lib/prisma";
import { put, get, del } from "@vercel/blob";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (userId && userId !== session.user.id) {
    if (!session.user.role || !hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const targetId = userId || session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: targetId },
    select: { avatarUrl: true },
  });

  if (!user?.avatarUrl) {
    return NextResponse.json({ error: "No avatar" }, { status: 404 });
  }

  try {
    const result = await get(user.avatarUrl, { access: "private", useCache: true });
    if (!result || result.statusCode !== 200) {
      return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
    }

    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Avatar fetch error:", e);
    return NextResponse.json({ error: `Failed to fetch avatar: ${message}` }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Blob storage is not configured (BLOB_READ_WRITE_TOKEN missing)." }, { status: 500 });
  }

  let formData: FormData;
  let file: File | null;

  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data. Ensure Content-Type is multipart/form-data." }, { status: 400 });
  }

  file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { avatarUrl: true },
  });

  const rawExt = file.name.includes(".") ? file.name.split(".").pop() ?? "" : "";
  const extension = /^[a-zA-Z0-9]+$/.test(rawExt) ? rawExt.toLowerCase() : "jpg";
  const stablePath = `avatars/${session.user.id}/avatar.${extension}`;

  try {
    await put(stablePath, file, {
      access: "private",
      allowOverwrite: true,
      contentType: file.type || undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Blob upload error:", e);
    return NextResponse.json({ error: `File upload to storage failed: ${message}` }, { status: 500 });
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { avatarUrl: `avatars/${session.user.id}/avatar.${extension}` },
    });
  } catch (e) {
    console.error("User update error:", e);
    return NextResponse.json({ error: "Failed to save avatar URL to database." }, { status: 500 });
  }

  if (existing?.avatarUrl && existing.avatarUrl !== `avatars/${session.user.id}/avatar.${extension}`) {
    try {
      await del(existing.avatarUrl);
    } catch (e) {
      console.error("Old avatar cleanup error:", e);
    }
  }

  return NextResponse.json({ avatarUrl: `avatars/${session.user.id}/avatar.${extension}` });
}
