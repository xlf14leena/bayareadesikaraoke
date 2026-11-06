import { randomBytes } from "node:crypto";
import { Prisma, type AttendeeRole, type DuetStatus, type EventDate, type EventSeries, type SignUpStatus } from "@prisma/client";
import { type RoundAppearances, type RoundConfig, type RoundKind, roundsFor, timesLabel } from "@/lib/rounds";
import { fillCheckInOrderSlots } from "@/lib/slots";
import { HOLDS_SPOT, settingsFor, songLockFor } from "@/lib/events";
import { FormError } from "@/lib/forms";
import { formatDateTime } from "@/lib/format";
import { OPENS_BEFORE_MS } from "@/lib/checkin";
import { prisma } from "@/lib/prisma";
import { looksAlike, songKey } from "@/lib/song-match";

// Sign-up rules from the spec ("Sign-up and Zelle payment", "Songs"):
// - A reserved or rejected spot is held for 24 hours, then expires.
// - When a spot in a role frees up, the first person on that role's waitlist
//   gets it (and 24 hours to pay, or is confirmed at once when it's free).
// - Expired and cancelled sign-ups release their songs.
// Every change to who holds a spot runs inside withDateLock, so two people
// pressing the button at once can't both take the last spot.

export const HOLD_MS = 24 * 60 * 60 * 1000;

/**
 * Statuses that can pick or edit songs, answer duet asks and be picked as a duet partner:
 * only confirmed sign-ups, so nobody takes a song before their payment is approved.
 */
export const PICKS_SONGS: SignUpStatus[] = ["CONFIRMED"];

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

/** When new sign-ups and "I've paid" confirmations stop: the date's close time, or its start. Songs follow songsOpen below. */
export function closesAt(date: Pick<EventDate, "signupClosesAt" | "startsAt">): Date {
  return date.signupClosesAt ?? date.startsAt;
}

/** Whether people can sign up for this date right now. */
export function acceptingSignUps(date: Pick<EventDate, "status" | "signupsOpen" | "signupClosesAt" | "startsAt">) {
  return date.status === "SCHEDULED" && date.signupsOpen && new Date() < closesAt(date);
}

type SongLockDate = Pick<
  EventDate,
  "status" | "signupClosesAt" | "startsAt" | "endsAt" | "overrides" | "songLock" | "checkInOpenedAt" | "songsLockedThrough"
> & { series: Pick<EventSeries, "songLock"> };

/**
 * Whether singers can still change their song or duet partner in this round, and named partners
 * still accept or back out. Depends on the date's song lock (songLockFor):
 * - ROUND_START: until an admin starts this round (or a later one), or the event ends.
 * - CHECK_IN: until an admin opens check-in or starts a round, and at the latest the start time.
 * - EVENT_START: until the start time.
 */
export function songsOpen(date: SongLockDate, round: number, now = new Date()): boolean {
  if (date.status !== "SCHEDULED") return false;
  switch (songLockFor(date, date.series)) {
    case "ROUND_START":
      return round > date.songsLockedThrough && now < date.endsAt;
    case "CHECK_IN":
      return !date.checkInOpenedAt && date.songsLockedThrough === 0 && now < closesAt(date);
    case "EVENT_START":
      return now < closesAt(date);
  }
}

/** songsOpen for each of the date's rounds, round 1 first. */
export function openRounds(date: SongLockDate, roundCount: number, now = new Date()): boolean[] {
  return Array.from({ length: roundCount }, (_, i) => songsOpen(date, i + 1, now));
}

/**
 * Tells singers until when they can change their songs on this date, with the time where there
 * is one. Null once every round is locked.
 */
export function songLockMessage(date: SongLockDate, roundCount: number, now = new Date()): string | null {
  const open = openRounds(date, roundCount, now);
  if (!open.some(Boolean)) return null;
  switch (songLockFor(date, date.series)) {
    case "ROUND_START": {
      const started = Math.min(date.songsLockedThrough, roundCount);
      if (started === 0) {
        return roundCount === 1
          ? "You can change your song and duet partner until the organizers start the round on the night."
          : "You can change each round's song and duet partner until the organizers start that round on the night.";
      }
      const which = started === 1 ? "Round 1 has" : `Rounds 1 to ${started} have`;
      return `${which} started, so ${started === 1 ? "its song is" : "their songs are"} locked. You can change the other rounds until each one starts.`;
    }
    case "CHECK_IN":
      return `You can change your songs and duet partners until the organizers open check-in at the venue. That can be as early as ${formatDateTime(new Date(date.startsAt.getTime() - OPENS_BEFORE_MS))}, and no later than ${formatDateTime(closesAt(date))}.`;
    case "EVENT_START":
      return `You can change your songs and duet partners until ${formatDateTime(closesAt(date))}.`;
  }
}

/** Whether people who already have a spot can still say they've paid. */
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

/** Frees the songs and singing slots of sign-ups that no longer hold a spot. */
export async function releaseSongs(tx: Tx, signUpIds: string[]) {
  if (signUpIds.length === 0) return;
  await tx.song.updateMany({
    where: { signUpId: { in: signUpIds }, status: "ACTIVE" },
    data: { status: "RELEASED", releasedAt: new Date() },
  });
  await tx.roundSlot.deleteMany({ where: { signUpId: { in: signUpIds } } });
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
  // Singers who checked in get their place in check-in-order rounds.
  await fillCheckInOrderSlots(tx, dateId, roundsFor(date, date.series), date);
}

/** Every round's song from the form, in round order. */
export function songInputs(form: FormData, rounds: RoundConfig[]): (SongInput | null)[] {
  return rounds.map((r, i) => songInput(form, i + 1, r.kind));
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

export type SongInput = {
  title: string;
  artist: string | null;
  youtubeUrl: string | null;
  duet: boolean;
  duetPartnerId: string | null;
  /** The song key the singer confirmed is a different song from a close match ("different1" field). */
  confirmedDifferent: string | null;
};

/**
 * Reads round N's song fields ("title1", "artist1", "youtube1", "kind1" = solo|duet, "partner1" = sign-up id).
 * Blank title = no song. A solos-only or duets-only round sets the kind whatever the form says.
 */
export function songInput(form: FormData, round: number, kind: RoundKind = "EITHER"): SongInput | null {
  const title = String(form.get(`title${round}`) ?? "").trim();
  const artist = String(form.get(`artist${round}`) ?? "").trim() || null;
  const youtubeUrl = String(form.get(`youtube${round}`) ?? "").trim() || null;
  const duet = kind === "EITHER" ? form.get(`kind${round}`) === "duet" : kind === "DUET";
  const duetPartnerId = (duet && String(form.get(`partner${round}`) ?? "").trim()) || null;
  const confirmedDifferent = String(form.get(`different${round}`) ?? "") || null;
  if (!title) {
    if (artist || youtubeUrl) throw new FormError(`Add the song title for round ${round}.`);
    return null;
  }
  if (title.length > 150) throw new FormError("Keep the song title under 150 characters.");
  if (artist && artist.length > 150) throw new FormError("Keep the film or artist under 150 characters.");
  if (youtubeUrl && !youtubeVideoId(youtubeUrl)) {
    throw new FormError(`The round ${round} track should be a YouTube link, like https://youtu.be/…`);
  }
  if (!songKey(title)) throw new FormError("The song title needs at least one letter or number.");
  return { title, artist, youtubeUrl, duet, duetPartnerId, confirmedDifferent };
}

/**
 * The songs that count toward how often someone sings: active, from a sign-up that holds a spot.
 * A partner who declined isn't singing it, so their id is dropped; a pending ask still counts,
 * so accepting it can never go over the limit.
 */
async function appearanceSongs(db: Tx, dateId: string, round?: number) {
  const songs = await db.song.findMany({
    where: { eventDateId: dateId, round, status: "ACTIVE", signUp: { status: { in: HOLDS_SPOT } } },
    select: { round: true, signUpId: true, duetPartnerId: true, duetStatus: true },
  });
  return songs.map((s) => ({ ...s, duetPartnerId: s.duetStatus === "DECLINED" ? null : s.duetPartnerId }));
}

/** How many times signUpId sings in a list of songs: their own songs plus the duets that name them. */
function countAppearances(songs: { signUpId: string; duetPartnerId: string | null }[], signUpId: string) {
  return songs.filter((s) => s.signUpId === signUpId || s.duetPartnerId === signUpId).length;
}

/**
 * For each round of a date (round 1 first), how many times each sign-up sings in it: their own
 * song plus the duets that name them as partner. Songs of `skipSongsOf` are left out, so a singer's
 * form sees what the others have done without its own picks (which it is about to replace).
 */
export async function appearancesByRound(
  db: Tx,
  dateId: string,
  roundCount: number,
  skipSongsOf?: string,
): Promise<RoundAppearances[]> {
  const songs = (await appearanceSongs(db, dateId)).filter((s) => s.signUpId !== skipSongsOf);
  return Array.from({ length: roundCount }, (_, i) => {
    const counts: RoundAppearances = {};
    for (const s of songs) {
      if (s.round !== i + 1) continue;
      counts[s.signUpId] = (counts[s.signUpId] ?? 0) + 1;
      if (s.duetPartnerId) counts[s.duetPartnerId] = (counts[s.duetPartnerId] ?? 0) + 1;
    }
    return counts;
  });
}

/**
 * Sets a sign-up's song for one round, first pick wins. The same song (same
 * song key or same YouTube video) is blocked; a close title (a typo, an extra
 * word) is refused with a nearMatch until the singer confirms it's a
 * different song. Changing the title
 * releases the old song and gives the new one a fresh song time; changing
 * only the artist, link or solo/duet keeps the song time. null clears the round.
 * With maxAppearances (the round's "times per singer"), a singer who already sings that many
 * times in the round as someone's duet partner can't add their own song, and a duet can't
 * name a partner who already sings that many times. Songs saved before a limit was set or
 * lowered stay; only new songs and new partners are checked.
 * A named partner has to accept: duetStatus is PENDING until they accept or decline (respondToDuet
 * on the event page), and a new partner or a new title asks them again.
 */
export async function setSong(
  tx: Tx,
  signUp: { id: string; eventDateId: string },
  round: number,
  input: SongInput | null,
  maxAppearances: number | null = null,
) {
  const current = await tx.song.findFirst({ where: { signUpId: signUp.id, round, status: "ACTIVE" } });
  if (!input) {
    if (current) {
      await tx.song.update({ where: { id: current.id }, data: { status: "RELEASED", releasedAt: new Date() } });
    }
    return;
  }
  if (input.duetPartnerId) {
    const partner = await tx.signUp.findUnique({
      where: { id: input.duetPartnerId },
      select: { eventDateId: true, status: true, role: true },
    });
    if (
      input.duetPartnerId === signUp.id ||
      !partner ||
      partner.eventDateId !== signUp.eventDateId ||
      partner.role !== "SINGER" ||
      !PICKS_SONGS.includes(partner.status)
    ) {
      throw new FormError(`Pick a duet partner for round ${round} from the confirmed singers on this date.`);
    }
  }
  if (maxAppearances != null) {
    // Everyone else's songs in this round; this sign-up's own song is the one being set.
    const roundSongs = (await appearanceSongs(tx, signUp.eventDateId, round)).filter((s) => s.signUpId !== signUp.id);
    const mine = countAppearances(roundSongs, signUp.id);
    if (!current && mine >= maxAppearances) {
      throw new FormError(
        `Round ${round}: you're already singing ${timesLabel(mine)} in this round as a duet partner, ` +
          `the most allowed. Leave your own round ${round} song blank.`,
      );
    }
    // A partner already on this song (and not declined) is kept even if the limit was lowered since.
    const keptPartner =
      !!current && current.duetPartnerId === input.duetPartnerId && current.duetStatus !== "DECLINED";
    if (input.duetPartnerId && !keptPartner) {
      const partnerCount = countAppearances(roundSongs, input.duetPartnerId);
      if (partnerCount >= maxAppearances) {
        const partner = await tx.signUp.findUnique({ where: { id: input.duetPartnerId }, select: { displayName: true } });
        throw new FormError(
          `Round ${round}: ${partner?.displayName ?? "That singer"} is already singing ${timesLabel(partnerCount)} ` +
            `in this round, the most allowed. Pick another partner or leave it as "Not picked yet".`,
        );
      }
    }
  }
  const normalizedTitle = songKey(input.title);
  const videoId = input.youtubeUrl ? youtubeVideoId(input.youtubeUrl) : null;
  // Compare keys from the titles, not the stored column, so songs saved
  // before a matching rule changed are checked by today's rules. The date
  // lock makes this check safe; the unique indexes are a backstop.
  const sameSong = !!current && songKey(current.title) === normalizedTitle;
  const others = await tx.song.findMany({
    where: { eventDateId: signUp.eventDateId, status: "ACTIVE", id: current ? { not: current.id } : undefined },
    select: { title: true, round: true, signUpId: true, youtubeVideoId: true },
    orderBy: { enteredAt: "asc" },
  });
  const sameTitle = others.find((o) => songKey(o.title) === normalizedTitle);
  const clash = sameTitle ?? (videoId ? others.find((o) => o.youtubeVideoId === videoId) : undefined);
  if (clash) {
    const mine = clash.signUpId === signUp.id;
    const what = sameTitle ? `"${input.title}"` : "That YouTube track";
    const as = sameTitle && clash.title !== input.title ? ` (as "${clash.title}")` : "";
    throw new FormError(
      mine
        ? `${what} is already your round ${clash.round} song${as}. Pick a different one.`
        : `${what} is already picked for this event${as}. Please choose another song.`,
    );
  }
  if (!sameSong && input.confirmedDifferent !== normalizedTitle) {
    const near = others.find((o) => looksAlike(o.title, input.title));
    if (near) {
      const whose = near.signUpId === signUp.id ? `your round ${near.round} song` : "a song someone already picked";
      throw new FormError(
        `Round ${round}: "${input.title}" looks a lot like "${near.title}", ${whose}. ` +
          `Change it, or tick "It's a different song" and save again.`,
        { round, key: normalizedTitle },
      );
    }
  }

  // The partner is asked again when they're new or the song is new; otherwise their answer stands.
  const duetStatus: DuetStatus | null = !input.duetPartnerId
    ? null
    : sameSong && current.duetPartnerId === input.duetPartnerId && current.duetStatus
      ? current.duetStatus
      : "PENDING";

  try {
    if (sameSong) {
      await tx.song.update({
        where: { id: current.id },
        data: {
          title: input.title,
          normalizedTitle,
          artist: input.artist,
          youtubeUrl: input.youtubeUrl,
          youtubeVideoId: videoId,
          // A new link needs its length looked up again (src/lib/youtube.ts).
          ...(videoId !== current.youtubeVideoId && { durationSeconds: null, durationCheckedAt: null }),
          duet: input.duet,
          duetPartnerId: input.duetPartnerId,
          duetStatus,
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
          duetPartnerId: input.duetPartnerId,
          duetStatus,
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
