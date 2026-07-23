import { requireAuth } from "@/modules/core/require-auth";
import { getSettings } from "@/modules/attendance/queries";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  await requireAuth("MANAGER");
  const settings = await getSettings();

  return <SettingsClient cutoffTime={settings.cutoffTime} />;
}
