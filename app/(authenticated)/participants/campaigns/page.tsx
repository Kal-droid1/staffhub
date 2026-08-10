import { requireAuth } from "@/modules/core/require-auth";
import CampaignsClient from "./campaigns-client";

export default async function CampaignsPage() {
  await requireAuth();
  return <CampaignsClient />;
}
