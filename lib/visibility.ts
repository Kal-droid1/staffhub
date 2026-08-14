import { prisma } from "@/lib/prisma";

export function visibleUserWhere(viewerIsHidden: boolean): { isHidden: boolean } | Record<string, never> {
  return viewerIsHidden ? {} : { isHidden: false };
}

export async function canViewUser(viewerIsHidden: boolean, targetUserId: string): Promise<boolean> {
  if (viewerIsHidden) return true;

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { isHidden: true },
  });

  return target ? !target.isHidden : true;
}
