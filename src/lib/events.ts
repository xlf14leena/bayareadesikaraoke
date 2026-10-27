import type { EventDate, EventSeries, SignUpStatus } from "@prisma/client";

// Sign-up statuses that hold a spot under the cap (spec: "Holding a spot under the cap").
export const HOLDS_SPOT: SignUpStatus[] = ["RESERVED", "UNDER_REVIEW", "CONFIRMED", "REJECTED"];

// Settings a date can override; anything not listed in date.overrides comes from the series.
export const OVERRIDE_KEYS = ["theme", "description", "pricing", "capacity"] as const;
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

/** "3 of 20" with a cap, or just "3" without one. */
export function spotsLabel(taken: number, cap: number | null): string {
  return cap == null ? String(taken) : `${taken} of ${cap}`;
}

/** Map link for a venue address. */
export function mapUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
