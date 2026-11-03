import { prisma } from "@/lib/prisma";
import { pacificDateOf } from "@/lib/schedule";

// Event page URLs nest under the group: /g/<group-slug>/<YYYY-MM-DD>-<title-slug>,
// e.g. /g/masala-mic/2026-11-15-bollywood-night. The Pacific date finds the
// event; the title part only tells apart two events on the same day, so a
// renamed series still opens at its old link.

/** "Bollywood Night!" -> "bollywood-night". */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

type Linkable = { startsAt: Date; series: { title: string; group: { slug: string } } };

/** The last path segment of an event page, e.g. "2026-11-15-bollywood-night". */
export function eventSegment(date: { startsAt: Date; series: { title: string } }): string {
  const title = slugify(date.series.title);
  return title ? `${pacificDateOf(date.startsAt)}-${title}` : pacificDateOf(date.startsAt);
}

/** Path of an event date's page. Pass the private key (`k`) for private events. */
export function eventPath(date: Linkable, key?: string | null): string {
  const path = `/g/${date.series.group.slug}/${eventSegment(date)}`;
  return key ? `${path}?k=${encodeURIComponent(key)}` : path;
}

/** Path of an event date's page by id, for callers that only hold the id. */
export async function eventPathById(dateId: string): Promise<string> {
  const date = await prisma.eventDate.findUnique({
    where: { id: dateId },
    select: { startsAt: true, series: { select: { title: true, group: { select: { slug: true } } } } },
  });
  return date ? eventPath(date) : "/me";
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Finds the event date a group URL points at. Matches the Pacific date, then
 * the title when the group has more than one event that day. A date an admin
 * moved also opens from the link for its original day. Returns its id, or null.
 */
export async function findEventDate(groupSlug: string, segment: string): Promise<string | null> {
  const m = /^(\d{4}-\d{2}-\d{2})(?:-(.*))?$/.exec(segment);
  if (!m) return null;
  const [, day, titleSlug = ""] = m;
  const noon = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(noon.getTime())) return null;
  // Pacific days fall inside this UTC window; the exact day is checked below.
  const window = { gte: new Date(noon.getTime() - DAY_MS), lte: new Date(noon.getTime() + DAY_MS) };
  const candidates = await prisma.eventDate.findMany({
    where: {
      status: { not: "DELETED" },
      series: { group: { slug: groupSlug } },
      OR: [{ startsAt: window }, { originalStartsAt: window }],
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, startsAt: true, originalStartsAt: true, series: { select: { title: true } } },
  });
  const onDay = (d: Date | null) => !!d && pacificDateOf(d) === day;
  const pick = (list: typeof candidates) =>
    (list.find((c) => slugify(c.series.title) === titleSlug) ?? list[0])?.id ?? null;
  const today = candidates.filter((c) => onDay(c.startsAt));
  return today.length ? pick(today) : pick(candidates.filter((c) => onDay(c.originalStartsAt)));
}
