import { getValidSession } from "@/modules/core/session";
import { redirect } from "next/navigation";
import ChangePasswordClient from "./change-password-client";

export default async function ChangePasswordPage() {
  const session = await getValidSession();
  if (!session?.user) {
    redirect(
      session?.invalidReason
        ? `/login?reason=${encodeURIComponent(session.invalidReason)}`
        : "/login"
    );
  }

  return <ChangePasswordClient />;
}
