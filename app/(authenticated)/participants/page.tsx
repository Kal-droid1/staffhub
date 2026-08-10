import { requireAuth } from "@/modules/core/require-auth";
import ParticipantsClient from "./participants-client";

export default async function ParticipantsPage() {
  await requireAuth();
  return <ParticipantsClient />;
}
