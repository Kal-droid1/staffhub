import { createContext, useContext } from "react";
import type { Session } from "next-auth";

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session | null {
  return useContext(SessionContext);
}

export function useUser() {
  const session = useContext(SessionContext);
  return session?.user ?? null;
}
