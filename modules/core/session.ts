import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "./auth";

export async function getSession(): Promise<Session | null> {
  return getServerSession(authOptions);
}

export async function getValidSession(): Promise<Session | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return session;
  return session;
}
