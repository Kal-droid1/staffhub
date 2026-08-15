import type { Metadata } from "next";
import { getValidSession } from "@/modules/core/session";
import { isTeacherOnlyUser } from "@/modules/core/roles";

export const metadata: Metadata = {
  title: "StaffHub",
  description: "Staff management platform",
};

import "./globals.css";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getValidSession();
  const teacherOnly = isTeacherOnlyUser(session?.user);

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/staffhub-favicon-32.png" sizes="32x32" />
        <link rel="icon" href="/staffhub-favicon-192.png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/staffhub-favicon-192.png" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL@20..48,100..700,0..1&display=swap" />
      </head>
      <body className={teacherOnly ? "teacher-only" : undefined}>{children}</body>
    </html>
  );
}
