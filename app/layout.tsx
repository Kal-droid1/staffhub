import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "StaffHub",
  description: "Staff management platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
