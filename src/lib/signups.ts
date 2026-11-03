import { randomBytes } from "node:crypto";
import { Prisma, type AttendeeRole, type EventDate, type EventSeries, type SignUpStatus } from "@prisma/client";
import { HOLDS_SPOT, settingsFor } from "@/lib/events";
import { FormError } from "@/lib/forms";
import { prisma } from "@/lib/prisma";

// Sign-up rules from the spec ("Sign-up and Zelle payment", "Songs"):
// - A reserved or rejected spot is held for 24 hours, then expires.
// - When a spot in a role frees up, the first person on that role's waitlist
//   gets it (and 24 hours to pay, or is confirmed at once when it's free).
// - Expired and cancelled sign-ups release their songs.
// Every change to who holds a spot runs inside withDateLock, so two people
// pressing the button at once can't both take the last spot.

export const HOLD_MS = 24 * 60 * 60 * 1000;

/** Payment screenshots: Vercel caps request bodies at 4.5 MB, and the page shrinks photos before upload. */
export const MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024;
export const SCREENSHOT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/** Statuses whose songs are held (a singer can pick or edit songs while in one of these). */
export const PICKS_SONGS: SignUpStatus[] = HOLDS_SPOT;

/** Statuses after which a person can sign up again. */
export const ENDED: SignUpStatus[] = ["EXPIRED", "CANCELLED"];

type Tx = Prisma.TransactionClient;
type DateWithSeries = EventDate & { series: EventSeries };

/** Runs fn in a transaction that holds this date's sign-up lock. */
export async function withDateLock<T>(dateId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"signups:" + dateId}))`;
      return fn(tx);
    },
    { timeout: 15000 },
  );
}

/** When new sign-ups, song changes and screenshot uploads stop: the date's close time, or its start. */
export function closesAt(date: Pick<EventDate, "signupClosesAt" | "startsAt">): Date {
  return date.signupClosesAt ?? date.startsAt;
}

/** Whether people can sign up for this date right now. */
export function acceptingSignUps(date: Pick<EventDate, "status" | "signupsOpen" | "signupClosesAt" | "startsAt">) {
  return date.status === "SCHEDULED" && date.signupsOpen && new Date() < closesAt(date);
}

/** Whether people who already have a spot can still add songs or upload proof. */
export function stillEditable(date: Pick<EventDate, "status" | "signupClosesAt" | "startsAt">) {
  return date.status === "SCHEDULED" && new Date() < closesAt(date);
}

export function priceFor(date: DateWithSeries, role: AttendeeRole): number {
  const s = settingsFor(date, date.series);
  return role === "SINGER" ? s.singerPriceCents : s.listenerPriceCents;
}

export function capFor(date: DateWithSeries, role: AttendeeRole): number | null {
  const s = settingsFor(date, date.series);
  return role === "SINGER" ? s.maxSingers : s.maxListeners;
}

export async function heldCount(tx: Tx, dateId: string, role: AttendeeRole): Promise<number> {
  return tx.signUp.count({ where: { eventDateId: dateId, role, status: { in: HOLDS_SPOT } } });
}

/** A Zelle memo code such as BADK-7Q4M that isn't in use yet. */
export async function newMemoCode(tx: Tx): Promise<string> {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  for (;;) {
    const code = "BADK-" + Array.from(randomBytes(4), (b) => alphabet[b % alphabet.length]).join("");
    if (!(await tx.signUp.findUnique({ where: { memoCode: code }, select: { id: true } }))) return code;
  }
}

/** Frees the songs of sign-ups that no longer hold a spot. */
export async function releaseSongs(tx: Tx, signUpIds: string[]) {
  if (signUpIds.length === 0) return;
  await tx.song.updateMany({
    where: { signUpId: { in: signUpIds }, status: "ACTIVE" },
    data: { status: "RELEASED", releasedAt: new Date() },
  });
}

/**
 * Expires overdue holds on a date and moves people off the waitlist into any
 * open spots. Call inside withDateLock.
 */
export async function settleDate(tx: Tx, dateId: string) {
  const now = new Date();
  const overdue = await tx.signUp.findMany({
    where: { eventDateId: dateId, status: { in: ["RESERVED", "REJECTED"] }, reservedUntil: { lt: now } },
    select: { id: true },
  });
  if (overdue.length) {
    await tx.signUp.updateMany({
      where: { id: { in: overdue.map((s) => s.id) } },
      data: { status: "EXPIRED", reservedUntil: null },
    });
    await releaseSongs(
      tx,
      overdue.map((s) => s.id),
    );
  }

  const date = await tx.eventDate.findUnique({ where: { id: dateId }, include: { series: true } });
  if (!date || date.status !== "SCHEDULED" || date.endsAt < now) return;
  for (const role of ["SINGER", "LISTENER"] as const) {
    const cap = capFor(date, role);
    let free = cap == null ? Infinity : cap - (await heldCount(tx, dateId, role));
    while (free > 0) {
      const next = await tx.signUp.findFirst({
        where: { eventDateId: dateId, role, status: "WAITLISTED" },
        orderBy: [{ waitlistedAt: "asc" }, { registeredAt: "asc" }],
      });
      if (!next) break;
      const amount = priceFor(date, role);
      await tx.signUp.update({
        where: { id: next.id },
        data:
          amount === 0
            ? { status: "CONFIRMED", amountDueCents: 0, reservedUntil: null }
            : { status: "RESERVED", amountDueCents: amount, reservedUntil: new Date(now.getTime() + HOLD_MS) },
      });
      free--;
    }
  }
}

/** settleDate in its own locked transaction. */
export async function settle(dateId: string) {
  await withDateLock(dateId, (tx) => settleDate(tx, dateId));
}

/** Settles every upcoming date with an overdue hold or a waitlist (daily cron backstop). */
export async function settleAll() {
  const dates = await prisma.eventDate.findMany({
    where: {
      endsAt: { gte: new Date() },
      signUps: {
        some: {
          OR: [
            { status: "WAITLISTED" },
            { status: { in: ["RESERVED", "REJECTED"] }, reservedUntil: { lt: new Date() } },
          ],
        },
      },
    },
    select: { id: true },
  });
  for (const d of dates) await settle(d.id);
  return dates.length;
}

// ---------- Songs ----------

/** Lowercase, without punctuation or extra spaces, so "Tujhe Dekha To!" matches "tujhe dekha to". */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The video id of a YouTube link, or null if it isn't one. */
export function youtubeVideoId(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([^/]+)/);
      if (m) id = m[2];
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

export type SongInput = { title: string; artist: string | null; youtubeUrl: string | null; duet: boolean };

/** Reads round N's song fields ("title1", "artist1", "youtube1", "kind1" = solo|duet). Blank title = no song. */
export function songInput(form: FormData, round: number): SongInput | null {
  const title = String(form.get(`title${round}`) ?? "").trim();
  const artist = String(form.get(`artist${round}`) ?? "").trim() || null;
  const youtubeUrl = String(form.get(`youtube${round}`) ?? "").trim() || null;
  const duet = form.get(`kind${round}`) === "duet";
  if (!title) {
    if (artist || youtubeUrl) throw new FormError(`Add the song title for round ${round}.`);
    return null;
  }
  if (title.length > 150) throw new FormError("Keep the song title under 150 characters.");
  if (artist && artist.length > 150) throw new FormError("Keep the film or artist under 150 characters.");
  if (youtubeUrl && !youtubeVideoId(youtubeUrl)) {
    throw new FormError(`The round ${round} track should be a YouTube link, like https://youtu.be/…`);
  }
  if (!normalizeTitle(title)) throw new FormError("The song title needs at least one letter or number.");
  return { title, artist, youtubeUrl, duet };
}

/**
 * Sets a sign-up's song for one round, first pick wins. Changing the title
 * releases the old song and gives the new one a fresh song time; changing
 * only the artist, link or solo/duet keeps the song time. null clears the round.
 */
export async function setSong(
  tx: Tx,
  signUp: { id: string; eventDateId: string },
  round: number,
  input: SongInput | null,
) {
  const current = await tx.song.findFirst({ where: { signUpId: signUp.id, round, status: "ACTIVE" } });
  if (!input) {
    if (current) {
      await tx.song.update({ where: { id: current.id }, data: { status: "RELEASED", releasedAt: new Date() } });
    }
    return;
  }
  const normalizedTitle = normalizeTitle(input.title);
  const videoId = input.youtubeUrl ? youtubeVideoId(input.youtubeUrl) : null;
  const sameSong = current && current.normalizedTitle === normalizedTitle;

  const clash = await tx.song.findFirst({
    where: {
      eventDateId: signUp.eventDateId,
      status: "ACTIVE",
      id: current ? { not: current.id } : undefined,
      OR: [{ normalizedTitle }, ...(videoId ? [{ youtubeVideoId: videoId }] : [])],
    },
  });
  if (clash) {
    const mine = clash.signUpId === signUp.id;
    const what = clash.normalizedTitle === normalizedTitle ? `"${input.title}"` : "That YouTube track";
    throw new FormError(
      mine
        ? `${what} is already your round ${clash.round} song. Pick a different one.`
        : `${what} is already picked for this event. Please choose another song.`,
    );
  }

  try {
    if (sameSong) {
      await tx.song.update({
        where: { id: current.id },
        data: {
          title: input.title,
          artist: input.artist,
          youtubeUrl: input.youtubeUrl,
          youtubeVideoId: videoId,
          duet: input.duet,
        },
      });
    } else {
      if (current) {
        await tx.song.update({ where: { id: current.id }, data: { status: "RELEASED", releasedAt: new Date() } });
      }
      await tx.song.create({
        data: {
          signUpId: signUp.id,
          eventDateId: signUp.eventDateId,
          round,
          title: input.title,
          normalizedTitle,
          artist: input.artist,
          youtubeUrl: input.youtubeUrl,
          youtubeVideoId: videoId,
          duet: input.duet,
        },
      });
    }
  } catch (e) {
    // Someone saved the same song a moment earlier (partial unique indexes).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new FormError(`"${input.title}" was just picked by someone else. Please choose another song.`);
    }
    throw e;
  }
}
