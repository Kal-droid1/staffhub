import { requireAuth } from "@/modules/core/require-auth";
import ArchiveClient from "./archive-client";

export default async function ArchivePage() {
  await requireAuth();
  return <ArchiveClient />;
}
