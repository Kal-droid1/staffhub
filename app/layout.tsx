import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "StaffHub",
  description: "Staff management platform",
};

import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/staffhub-favicon-32.png" sizes="32x32" />
        <link rel="icon" href="/staffhub-favicon-192.png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/staffhub-favicon-192.png" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL@20..48,100..700,0..1&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
