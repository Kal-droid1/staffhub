import { prisma } from "@/lib/prisma";

export async function getJobTitles() {
  return prisma.jobTitle.findMany({ orderBy: { name: "asc" } });
}

export async function createJobTitle(name: string) {
  return prisma.jobTitle.create({ data: { name: name.trim() } });
}

export async function updateJobTitle(id: string, name: string) {
  return prisma.jobTitle.update({
    where: { id },
    data: { name: name.trim() },
  });
}

export async function deleteJobTitle(id: string) {
  return prisma.jobTitle.delete({ where: { id } });
}
