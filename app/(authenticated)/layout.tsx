import { getValidSession } from "@/modules/core/session";
import { isTeacherOnlyUser } from "@/modules/core/roles";
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
  const isTeacherOnly = isTeacherOnlyUser(session?.user);

  return (
    <SessionProvider session={session}>
      <SessionGuard>
        {session?.user ? (
          <>
            {!isTeacherOnly && <GlobalParticipantSearch />}
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
