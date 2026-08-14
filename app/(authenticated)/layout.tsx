import { getValidSession } from "@/modules/core/session";
import NavBar from "@/modules/core/nav-bar";
import GlobalParticipantSearch from "./global-participant-search";
import SessionProvider from "./session-provider";
import SessionGuard from "./session-guard";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getValidSession();

  return (
    <SessionProvider session={session}>
      <SessionGuard>
        {session?.user ? (
          <>
            <GlobalParticipantSearch />
            <div style={{ position: "relative" }}>
              <NavBar />
              {children}
            </div>
          </>
        ) : null}
      </SessionGuard>
    </SessionProvider>
  );
}
