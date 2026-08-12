import { requireAuth } from "@/modules/core/require-auth";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  await requireAuth();
  return <SettingsClient />;
}
