import { prisma } from "@/lib/prisma";
import { thumbnailFor, type GroupThumbnail } from "@/lib/group-thumbnail";

type ThumbGroup = Parameters<typeof thumbnailFor>[0];

/**
 * Thumbnails for these groups, by group id. Looks up event banners only for
 * groups with neither a thumbnail nor a banner of their own.
 */
export async function groupThumbnails(groups: ThumbGroup[]): Promise<Map<string, GroupThumbnail>> {
  const unique = [...new Map(groups.map((g) => [g.id, g])).values()];
  const bare = unique.filter((g) => !g.thumbnailUrl && !g.bannerUrl).map((g) => g.id);
  const eventBanners = new Map<string, string>();
  if (bare.length) {
    // Newest event first, so each group keeps the first banner it meets.
    const series = await prisma.eventSeries.findMany({
      where: { groupId: { in: bare }, bannerUrl: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { groupId: true, bannerUrl: true },
    });
    for (const s of series) if (!eventBanners.has(s.groupId)) eventBanners.set(s.groupId, s.bannerUrl!);
  }
  return new Map(unique.map((g) => [g.id, thumbnailFor(g, eventBanners.get(g.id))]));
}

/** One group's thumbnail. */
export async function groupThumbnail(group: ThumbGroup): Promise<GroupThumbnail> {
  return (await groupThumbnails([group])).get(group.id)!;
}
