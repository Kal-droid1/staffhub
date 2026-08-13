import { requireAuth } from "@/modules/core/require-auth";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const user = await requireAuth();
  return <SettingsClient role={user.role} />;
}
