// A group's square picture in event lists. The group's own thumbnail when it
// has one; otherwise the first of these that exists: its banner (cropped to a
// square), the banner of its newest event, or a tile with its initials.
// Safe to import from client components; the database lookup is in
// src/lib/group-thumbnails.ts.

export type GroupThumbnail =
  | { kind: "image"; src: string; source: "thumbnail" | "banner" | "event" }
  | { kind: "initials"; initials: string; tile: string };

// Tile colors from the site's palette (src/app/globals.css). Each group always
// gets the same one, so its tile is recognisable from list to list.
const TILES = [
  "bg-gradient-to-br from-royal to-cobalt text-gold",
  "bg-gradient-to-br from-cobalt to-lapis text-white",
  "bg-gradient-to-br from-gold to-kicker text-royal",
  "bg-gradient-to-br from-lapis to-royal text-kicker",
];

/** Up to two letters: the first of the first two words, or the first two of a single word. */
export function initialsOf(name: string): string {
  const words = name.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (words.length === 0) return "?";
  const [first, second] = words.map((w) => [...w]);
  const letters = second ? [first[0], second[0]] : first.slice(0, 2);
  return letters.join("").toUpperCase();
}

function tileFor(key: string): string {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
  return TILES[hash % TILES.length];
}

export function thumbnailFor(
  group: { id: string; name: string; thumbnailUrl: string | null; bannerUrl: string | null },
  latestEventBanner?: string | null,
): GroupThumbnail {
  if (group.thumbnailUrl) return { kind: "image", src: group.thumbnailUrl, source: "thumbnail" };
  if (group.bannerUrl) return { kind: "image", src: group.bannerUrl, source: "banner" };
  if (latestEventBanner) return { kind: "image", src: latestEventBanner, source: "event" };
  return { kind: "initials", initials: initialsOf(group.name), tile: tileFor(group.id) };
}
