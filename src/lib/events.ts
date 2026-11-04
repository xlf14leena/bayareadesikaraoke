import type { EventDate, EventSeries, SignUpStatus } from "@prisma/client";
import { formatPrice } from "@/lib/format";

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
// Rounds are read with roundsFor in src/lib/rounds.ts; the banner with bannerFor (date.bannerUrl is set only when overridden).
export const OVERRIDE_KEYS = ["theme", "description", "pricing", "capacity", "rounds", "banner"] as const;
export type OverrideKey = (typeof OVERRIDE_KEYS)[number];

type DateSettings = Pick<
  EventDate,
  | "overrides"
  | "theme"
  | "themeRequired"
  | "description"
  | "singerPriceCents"
  | "listenerPriceCents"
  | "maxSingers"
  | "maxListeners"
>;
type SeriesSettings = Pick<
  EventSeries,
  "theme" | "themeRequired" | "description" | "singerPriceCents" | "listenerPriceCents" | "maxSingers" | "maxListeners"
>;

export type EventSettings = SeriesSettings;

/** The settings that apply to a date: its own overrides, otherwise the series (template) ones. */
export function settingsFor(date: DateSettings, series: SeriesSettings): EventSettings {
  const own = (key: OverrideKey) => date.overrides.includes(key);
  return {
    theme: own("theme") ? date.theme : series.theme,
    themeRequired: own("theme") ? date.themeRequired : series.themeRequired,
    description: own("description") ? date.description : series.description,
    singerPriceCents: own("pricing") ? (date.singerPriceCents ?? 0) : series.singerPriceCents,
    listenerPriceCents: own("pricing") ? (date.listenerPriceCents ?? 0) : series.listenerPriceCents,
    maxSingers: own("capacity") ? date.maxSingers : series.maxSingers,
    maxListeners: own("capacity") ? date.maxListeners : series.maxListeners,
  };
}

/** Whether nobody pays on a date: both roles cost $0. */
export function isFree(s: Pick<EventSettings, "singerPriceCents" | "listenerPriceCents">): boolean {
  return s.singerPriceCents === 0 && s.listenerPriceCents === 0;
}

/** "Free", or "Singer $20 · Listener Free". */
export function pricesLabel(s: Pick<EventSettings, "singerPriceCents" | "listenerPriceCents">): string {
  if (isFree(s)) return "Free";
  return `Singer ${formatPrice(s.singerPriceCents)} · Listener ${formatPrice(s.listenerPriceCents)}`;
}

/** "3 of 20" with a cap, or just "3" without one. */
export function spotsLabel(taken: number, cap: number | null): string {
  return cap == null ? String(taken) : `${taken} of ${cap}`;
}

/** Map link for a venue address. */
export function mapUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
