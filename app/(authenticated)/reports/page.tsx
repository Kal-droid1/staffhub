import { requireAuth } from "@/modules/core/require-auth";
import ReportsClient from "./reports-client";

export default async function ReportsPage() {
  const user = await requireAuth("MANAGER");
  return <ReportsClient currentUserId={user.id} />;
}
