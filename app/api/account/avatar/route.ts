import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  const blob = await put(`avatars/${session.user.id}/${file.name}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarUrl: blob.url },
  });

  return NextResponse.json({ avatarUrl: blob.url });
}
