import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { hasRole } from "@/modules/core/roles";
import {
  getJobTitles,
  createJobTitle,
  updateJobTitle,
  deleteJobTitle,
} from "@/lib/job-titles";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.role || !hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const titles = await getJobTitles();
  return NextResponse.json(titles);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || !hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { name } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  try {
    const title = await createJobTitle(name);
    return NextResponse.json(title, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A job title with this name already exists." }, { status: 409 });
    }
    const msg = e instanceof Error ? e.message : "Failed to create job title";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || !hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { id, name } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  try {
    const title = await updateJobTitle(id, name);
    return NextResponse.json(title);
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A job title with this name already exists." }, { status: 409 });
    }
    const msg = e instanceof Error ? e.message : "Failed to update job title";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || !hasRole(session.user.role as "MANAGER" | "ADMIN", "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  try {
    await deleteJobTitle(id);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete job title";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
