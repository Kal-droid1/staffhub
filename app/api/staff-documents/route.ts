import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import type { Role } from "@prisma/client";

const CATEGORIES = [
  "Marriage Certificate",
  "Number of Kids",
  "Employment Contract",
  "Job Description",
  "Education Certificate",
  "Leave Permission",
  "Statement of Commitment to Child Protection",
  "Sick Leave",
  "Other",
];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || !hasRole(session.user.role as Role, "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const docs = await prisma.staffDocument.findMany({
    where: { userId },
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true,
      category: true,
      fileName: true,
      fileUrl: true,
      uploadedAt: true,
      uploadedBy: { select: { name: true } },
    },
  });

  const grouped: Record<string, typeof docs> = {};
  for (const cat of CATEGORIES) grouped[cat] = [];
  for (const d of docs) {
    if (grouped[d.category]) grouped[d.category].push(d);
  }

  return NextResponse.json(grouped);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || !hasRole(session.user.role as Role, "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const userId = formData.get("userId") as string;
  const category = formData.get("category") as string;
  const file = formData.get("file") as File | null;

  if (!userId || !category || !file || file.size === 0) {
    return NextResponse.json({ error: "userId, category, and file are required" }, { status: 400 });
  }

  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const blob = await put(`staff-documents/${category}/${file.name}`, file, {
    access: "private",
    addRandomSuffix: true,
  });

  const doc = await prisma.staffDocument.create({
    data: {
      userId,
      category,
      fileUrl: blob.url,
      fileName: file.name,
      uploadedById: session.user!.id,
    },
    select: {
      id: true,
      category: true,
      fileName: true,
      fileUrl: true,
      uploadedAt: true,
      uploadedBy: { select: { name: true } },
    },
  });

  return NextResponse.json(doc, { status: 201 });
}
