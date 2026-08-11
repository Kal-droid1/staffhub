import { requireAuth } from "@/modules/core/require-auth";
import ImportClient from "./import-client";

export default async function ImportPage() {
  await requireAuth("MANAGER");
  return <ImportClient />;
}
