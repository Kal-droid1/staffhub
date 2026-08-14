"use client";

import { useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    const invalidReason = (session as { invalidReason?: string } | null)?.invalidReason;
    const isInvalid = Boolean(invalidReason);
    const isUnauthenticated = status === "unauthenticated";

    if (!isInvalid && !isUnauthenticated) return;

    const target = invalidReason
      ? `/login?reason=${encodeURIComponent(invalidReason)}`
      : "/login";

    signOut({ redirect: false }).then(() => {
      router.replace(target);
      router.refresh();
    });
  }, [status, session, router]);

  return <>{children}</>;
}
