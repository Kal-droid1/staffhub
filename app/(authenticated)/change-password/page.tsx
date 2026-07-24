import { requireAuth } from "@/modules/core/require-auth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth";
import { redirect } from "next/navigation";
import ChangePasswordClient from "./change-password-client";

export default async function ChangePasswordPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return <ChangePasswordClient />;
}
