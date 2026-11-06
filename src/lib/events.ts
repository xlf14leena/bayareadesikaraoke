import type { EventDate, EventSeries, SignUpStatus, SongLock } from "@prisma/client";

// Sign-up statuses that hold a spot under the cap (spec: "Holding a spot under the cap").
export const HOLDS_SPOT: SignUpStatus[] = ["RESERVED", "UNDER_REVIEW", "CONFIRMED", "REJECTED"];

export const STATUS_LABEL: Record<SignUpStatus, string> = {
  WAITLISTED: "Waitlisted",
  RESERVED: "Reserved, awaiting payment",
  UNDER_REVIEW: "Payment under review",
  CONFIRMED: "Confirmed",
  REJECTED: "Payment rejected",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

// Settings a date can override; anything not listed in date.overrides comes from the series.
// Rounds are read with roundsFor in src/lib/rounds.ts; the banner with bannerFor (date.bannerUrl is set only when overridden);
// Zelle details with zelleFor below; the song lock with songLockFor below.
export const OVERRIDE_KEYS = ["description", "pricing", "capacity", "rounds", "banner", "zelle", "songLock"] as const;
export type OverrideKey = (typeof OVERRIDE_KEYS)[number];

type DateSettings = Pick<
  EventDate,
  | "overrides"
  | "description"
  | "singerPriceCents"
  | "listenerPriceCents"
  | "maxSingers"
  | "maxListeners"
>;
type SeriesSettings = Pick<
  EventSeries,
  "description" | "singerPriceCents" | "listenerPriceCents" | "maxSingers" | "maxListeners"
>;

export type EventSettings = SeriesSettings;

/** The settings that apply to a date: its own overrides, otherwise the series (template) ones. */
export function settingsFor(date: DateSettings, series: SeriesSettings): EventSettings {
  const own = (key: OverrideKey) => date.overrides.includes(key);
  return {
    description: own("description") ? date.description : series.description,
    singerPriceCents: own("pricing") ? (date.singerPriceCents ?? 0) : series.singerPriceCents,
    listenerPriceCents: own("pricing") ? (date.listenerPriceCents ?? 0) : series.listenerPriceCents,
    maxSingers: own("capacity") ? date.maxSingers : series.maxSingers,
    maxListeners: own("capacity") ? date.maxListeners : series.maxListeners,
  };
}

/** "3 of 20" with a cap, or just "3" without one. */
export function spotsLabel(taken: number, cap: number | null): string {
  return cap == null ? String(taken) : `${taken} of ${cap}`;
}

/** Map link for a venue address. */
export function mapUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export type ZelleDetails = { name: string | null; handle: string | null };

/** Where members send Zelle payments for a date: its own details, otherwise the event's. */
export function zelleFor(
  date: Pick<EventDate, "overrides" | "zelleName" | "zelleHandle">,
  series: Pick<EventSeries, "zelleName" | "zelleHandle">,
): ZelleDetails {
  const from = date.overrides.includes("zelle") ? date : series;
  return { name: from.zelleName, handle: from.zelleHandle };
}

/** When singers can no longer change songs or duet partners (songsOpen in src/lib/signups.ts). */
export const SONG_LOCKS: SongLock[] = ["ROUND_START", "CHECK_IN", "EVENT_START"];

/** Admin labels for each choice. */
export const SONG_LOCK_LABEL: Record<SongLock, string> = {
  ROUND_START: "When each round starts",
  CHECK_IN: "When check-in opens",
  EVENT_START: "At the start time",
};

/** What singers are told on the event page about when their songs lock. */
export const SONG_LOCK_NOTE: Record<SongLock, string> = {
  ROUND_START: "You can change a round's song until that round starts.",
  CHECK_IN: "You can change your songs until check-in opens.",
  EVENT_START: "You can change your songs until the event starts.",
};

/** The song lock that applies to a date: its own, otherwise the event's. */
export function songLockFor(
  date: Pick<EventDate, "overrides" | "songLock">,
  series: Pick<EventSeries, "songLock">,
): SongLock {
  return (date.overrides.includes("songLock") && date.songLock) || series.songLock;
}
