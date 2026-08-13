import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { prisma } from "@/lib/prisma";
import { put, get } from "@vercel/blob";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { avatarUrl: true },
  });

  if (!user?.avatarUrl) {
    return NextResponse.json({ error: "No avatar" }, { status: 404 });
  }

  try {
    const result = await get(user.avatarUrl, { access: "private" });
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

  let blob;
  try {
    blob = await put(`avatars/${session.user.id}/${file.name}`, file, {
      access: "private",
      addRandomSuffix: true,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Blob upload error:", e);
    return NextResponse.json({ error: `File upload to storage failed: ${message}` }, { status: 500 });
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { avatarUrl: blob.url },
    });
  } catch (e) {
    console.error("User update error:", e);
    return NextResponse.json({ error: "Failed to save avatar URL to database." }, { status: 500 });
  }

  return NextResponse.json({ avatarUrl: blob.url });
}
