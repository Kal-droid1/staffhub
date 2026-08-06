import { getSession } from "@/modules/core/session";
import NavBar from "@/modules/core/nav-bar";
import SessionProvider from "./session-provider";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <SessionProvider session={session}>
      <div style={{ position: "relative" }}>
        <NavBar />
        {children}
      </div>
    </SessionProvider>
  );
}
