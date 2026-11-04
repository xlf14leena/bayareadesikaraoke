import type { EventDate, EventSeries, SignUpStatus } from "@prisma/client";

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
// Zelle details with zelleFor below.
export const OVERRIDE_KEYS = ["theme", "description", "pricing", "capacity", "rounds", "banner", "zelle"] as const;
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

export type ZelleDetails = { name: string | null; handle: string | null };

/** Where members send Zelle payments for a date: its own details, otherwise the event's. */
export function zelleFor(
  date: Pick<EventDate, "overrides" | "zelleName" | "zelleHandle">,
  series: Pick<EventSeries, "zelleName" | "zelleHandle">,
): ZelleDetails {
  const from = date.overrides.includes("zelle") ? date : series;
  return { name: from.zelleName, handle: from.zelleHandle };
}

/** "3 of 20" with a cap, or just "3" without one. */
export function spotsLabel(taken: number, cap: number | null): string {
  return cap == null ? String(taken) : `${taken} of ${cap}`;
}

/** Map link for a venue address. */
export function mapUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
