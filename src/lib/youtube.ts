import { prisma } from "@/lib/prisma";

// Track lengths from the YouTube Data API (videos.list, part=contentDetails), which needs an API key
// in YOUTUBE_API_KEY. Without one nothing is looked up and songs show no length.
// Each request covers up to 50 videos and costs 1 unit of the free 10,000-a-day quota.

const API = "https://www.googleapis.com/youtube/v3/videos";
const BATCH = 50;

/** Seconds in an ISO 8601 duration such as "PT4M12S" or "P1DT2H", or null if it isn't one. */
export function parseIsoDuration(iso: string): number | null {
  const m = iso.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const [, d, h, min, s] = m.map((x) => Number(x ?? 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

/**
 * Asks YouTube for the length of each video. The map has every id YouTube answered for:
 * seconds, or null for a video with no length (private, deleted, or a live stream).
 * Returns null when there is no API key or the request failed, so the caller can try again later.
 */
export async function fetchDurations(videoIds: string[]): Promise<Map<string, number | null> | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key || videoIds.length === 0) return null;
  const found = new Map<string, number | null>();
  for (let i = 0; i < videoIds.length; i += BATCH) {
    const ids = videoIds.slice(i, i + BATCH);
    const url = `${API}?part=contentDetails&id=${ids.join(",")}&key=${encodeURIComponent(key)}`;
    let items: { id: string; contentDetails?: { duration?: string } }[];
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
      if (!res.ok) {
        console.error(`YouTube lookup failed: ${res.status} ${await res.text().catch(() => "")}`.slice(0, 500));
        return found.size ? found : null;
      }
      items = (await res.json()).items ?? [];
    } catch (e) {
      console.error("YouTube lookup failed:", e);
      return found.size ? found : null;
    }
    // A video missing from the answer is private or deleted: YouTube answered, it just has no length.
    for (const id of ids) found.set(id, null);
    for (const item of items) {
      const seconds = item.contentDetails?.duration ? parseIsoDuration(item.contentDetails.duration) : null;
      found.set(item.id, seconds && seconds > 0 ? seconds : null);
    }
  }
  return found;
}

/** The length of one video, for the song form's preview. undefined when it couldn't be looked up. */
export async function fetchDuration(videoId: string): Promise<number | null | undefined> {
  const found = await fetchDurations([videoId]);
  return found ? found.get(videoId) : undefined;
}

/**
 * Fills in the length of songs whose link hasn't been looked up yet: one date's songs (after a save)
 * or every song (the daily cron, which also backfills songs picked before lengths existed).
 * Songs whose lookup failed stay unchecked and are tried again next time. Returns how many songs got a length.
 */
export async function fillSongLengths({ eventDateId, limit = 2000 }: { eventDateId?: string; limit?: number } = {}) {
  if (!process.env.YOUTUBE_API_KEY) return 0;
  const pending = await prisma.song.findMany({
    where: { eventDateId, youtubeVideoId: { not: null }, durationCheckedAt: null },
    distinct: ["youtubeVideoId"],
    select: { youtubeVideoId: true },
    take: limit,
  });
  const ids = pending.map((s) => s.youtubeVideoId!);
  const found = await fetchDurations(ids);
  if (!found) return 0;
  let filled = 0;
  const now = new Date();
  for (const [id, seconds] of found) {
    const { count } = await prisma.song.updateMany({
      where: { youtubeVideoId: id, durationCheckedAt: null },
      data: { durationSeconds: seconds, durationCheckedAt: now },
    });
    if (seconds != null) filled += count;
  }
  return filled;
}
