import { requireAuth } from "@/modules/core/require-auth";
import ParticipantDetailClient from "./detail-client";

export default async function ParticipantDetailPage() {
  await requireAuth();
  return <ParticipantDetailClient />;
}
