import type { EventDate, EventSeries, SlotMode } from "@prisma/client";
import { FormError } from "@/lib/forms";

// The rounds of an event: how many there are, and for each one whether songs
// are solos, duets or either, and how singers get their slot once they check
// in (src/lib/slots.ts), plus an optional theme. The series (template) sets
// them; a date can set its own by listing "rounds" in its overrides. Stored as
// JSON, round 1 first.

/** SOLO and DUET fix the kind of song; EITHER lets each singer choose. */
export type RoundKind = "SOLO" | "DUET" | "EITHER";
/** theme is null for no theme; themeRequired says whether songs must fit it or it is a suggestion. */
export type RoundConfig = { kind: RoundKind; slotMode: SlotMode; theme: string | null; themeRequired: boolean };

export const MAX_THEME_LENGTH = 120;

export const MAX_ROUNDS = 6;
const KINDS: RoundKind[] = ["SOLO", "DUET", "EITHER"];
const SLOT_MODES: SlotMode[] = ["PICK", "CHECKIN_ORDER", "PAYMENT_ORDER"];

/** What events had before rounds were configurable: two rounds, solo or duet. */
export const DEFAULT_ROUNDS: RoundConfig[] = [
  { kind: "EITHER", slotMode: "PICK", theme: null, themeRequired: false },
  { kind: "EITHER", slotMode: "CHECKIN_ORDER", theme: null, themeRequired: false },
];

export const ROUND_KIND_LABEL: Record<RoundKind, string> = {
  SOLO: "Solos only",
  DUET: "Duets only",
  EITHER: "Solo or duet",
};

export const SLOT_MODE_LABEL: Record<SlotMode, string> = {
  PICK: "Singers pick a slot",
  CHECKIN_ORDER: "Check-in order",
  PAYMENT_ORDER: "Payment order",
};

/** The stored JSON as rounds. Anything unreadable falls back to the default two rounds. */
export function parseRounds(raw: unknown): RoundConfig[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_ROUNDS;
  const rounds = raw.slice(0, MAX_ROUNDS).map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    return {
      kind: KINDS.includes(o.kind as RoundKind) ? (o.kind as RoundKind) : "EITHER",
      slotMode: SLOT_MODES.includes(o.slotMode as SlotMode) ? (o.slotMode as SlotMode) : "PICK",
      theme: typeof o.theme === "string" && o.theme.trim() ? o.theme.trim().slice(0, MAX_THEME_LENGTH) : null,
      themeRequired: o.themeRequired === true,
    };
  });
  return rounds;
}

/** The rounds that apply to a date: its own when it overrides them, otherwise the series'. */
export function roundsFor(date: Pick<EventDate, "overrides" | "rounds">, series: Pick<EventSeries, "rounds">): RoundConfig[] {
  return parseRounds(date.overrides.includes("rounds") && date.rounds != null ? date.rounds : series.rounds);
}

/** Round numbers, 1 to n. */
export function roundNumbers(rounds: RoundConfig[]): number[] {
  return rounds.map((_, i) => i + 1);
}

/** The config of round n (1-based), or null when the event has fewer rounds. */
export function roundAt(rounds: RoundConfig[], round: number): RoundConfig | null {
  return Number.isInteger(round) && round >= 1 ? (rounds[round - 1] ?? null) : null;
}

/** Reads the rounds fields of the admin forms: "roundCount", then "round1Kind", "round1SlotMode", "round1Theme", "round1ThemeRequired", … */
export function roundsFromForm(form: FormData): RoundConfig[] {
  const count = Number(form.get("roundCount"));
  if (!Number.isInteger(count) || count < 1 || count > MAX_ROUNDS) {
    throw new FormError(`Pick between 1 and ${MAX_ROUNDS} rounds.`);
  }
  return Array.from({ length: count }, (_, i) => {
    const kind = form.get(`round${i + 1}Kind`);
    const slotMode = form.get(`round${i + 1}SlotMode`);
    const fallback = DEFAULT_ROUNDS[i] ?? DEFAULT_ROUNDS[1];
    const rawTheme = form.get(`round${i + 1}Theme`);
    const theme = typeof rawTheme === "string" ? rawTheme.trim() : "";
    if (theme.length > MAX_THEME_LENGTH) {
      throw new FormError(`Keep the round ${i + 1} theme under ${MAX_THEME_LENGTH} characters.`);
    }
    return {
      kind: KINDS.includes(kind as RoundKind) ? (kind as RoundKind) : fallback.kind,
      slotMode: SLOT_MODES.includes(slotMode as SlotMode) ? (slotMode as SlotMode) : fallback.slotMode,
      theme: theme || null,
      themeRequired: !!theme && form.get(`round${i + 1}ThemeRequired`) === "on",
    };
  });
}

/** "2 rounds: 1 solo or duet, singers pick a slot; 2 …", for showing the template's rounds. */
export function describeRounds(rounds: RoundConfig[]): string {
  return rounds
    .map(
      (r, i) =>
        `Round ${i + 1}: ${ROUND_KIND_LABEL[r.kind].toLowerCase()}, ${SLOT_MODE_LABEL[r.slotMode].toLowerCase()}` +
        (r.theme ? `, theme "${r.theme}" (${r.themeRequired ? "songs must fit" : "suggestion"})` : ""),
    )
    .join("\n");
}

/** The different themes across the rounds, in round order, for one-line summaries. */
export function roundThemes(rounds: RoundConfig[]): string[] {
  return [...new Set(rounds.map((r) => r.theme).filter((t): t is string => !!t))];
}
