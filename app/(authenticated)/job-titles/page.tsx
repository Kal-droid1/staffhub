import { requireAuth } from "@/modules/core/require-auth";
import { getJobTitles } from "@/lib/job-titles";
import JobTitlesClient from "./job-titles-client";

export default async function JobTitlesPage() {
  await requireAuth("MANAGER");
  const titles = await getJobTitles();
  return <JobTitlesClient initialTitles={JSON.parse(JSON.stringify(titles))} />;
}
