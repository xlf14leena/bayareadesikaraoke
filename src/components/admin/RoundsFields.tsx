"use client";

import { useState } from "react";
import type { SlotMode } from "@prisma/client";
import { inputClass, labelClass, selectClass } from "@/components/ui";
import { MAX_APPEARANCES, MAX_ROUNDS, MAX_THEME_LENGTH, type RoundConfig, type RoundKind } from "@/lib/rounds";

/**
 * How many rounds an event has, and for each one solo/duet, how singers get
 * their slot, an optional theme, and for rounds with duets how many times one
 * singer can sing. Posts "roundCount" and "round{n}Kind" / "round{n}SlotMode" /
 * "round{n}Theme" / "round{n}ThemeRequired" / "round{n}MaxAppearances" (read by
 * roundsFromForm in src/lib/rounds.ts).
 */
export default function RoundsFields({ initial }: { initial: RoundConfig[] }) {
  const [count, setCount] = useState(initial.length);
  // Settings for every possible round, so lowering the count and raising it again keeps them.
  const [rounds, setRounds] = useState<RoundConfig[]>(() =>
    Array.from({ length: MAX_ROUNDS }, (_, i) => {
      const r = initial[i] ?? {
        kind: "EITHER",
        slotMode: "CHECKIN_ORDER",
        theme: null,
        themeRequired: true,
        maxAppearances: null,
      } satisfies RoundConfig;
      // With no theme yet, "Songs must fit" starts ticked for when one is typed.
      return r.theme ? r : { ...r, themeRequired: true };
    }),
  );
  const change = (i: number, patch: Partial<RoundConfig>) =>
    setRounds((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3">
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Number of rounds</span>
        <select
          name="roundCount"
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className={selectClass}
        >
          {Array.from({ length: MAX_ROUNDS }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
      </label>
      <div className="space-y-2">
        {rounds.slice(0, count).map((r, i) => (
          <fieldset key={i} className="flex flex-wrap items-end gap-x-4 gap-y-3 rounded-lg border border-line bg-mist/40 p-3">
            <legend className="sr-only">Round {i + 1}</legend>
            <span aria-hidden className="w-full font-semibold text-royal sm:w-20 sm:pb-2">
              Round {i + 1}
            </span>
            <label className="block min-w-0 max-w-full">
              <span className={labelClass}>Songs</span>
              <select
                name={`round${i + 1}Kind`}
                value={r.kind}
                onChange={(e) => change(i, { kind: e.target.value as RoundKind })}
                className={selectClass}
              >
                <option value="EITHER">Solo or duet</option>
                <option value="SOLO">Solos only</option>
                <option value="DUET">Duets only</option>
              </select>
            </label>
            <label className="block min-w-0 max-w-full">
              <span className={labelClass}>Singing order</span>
              <select
                name={`round${i + 1}SlotMode`}
                value={r.slotMode}
                onChange={(e) => change(i, { slotMode: e.target.value as SlotMode })}
                className={selectClass}
              >
                <option value="PICK">Singers pick a slot</option>
                <option value="CHECKIN_ORDER">Check-in order</option>
                <option value="PAYMENT_ORDER">Payment order</option>
              </select>
            </label>
            {r.kind !== "SOLO" && (
              <label className="block w-36 max-w-full">
                <span className={labelClass}>Times per singer</span>
                <input
                  name={`round${i + 1}MaxAppearances`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_APPEARANCES}
                  step={1}
                  value={r.maxAppearances ?? ""}
                  onChange={(e) => change(i, { maxAppearances: e.target.value ? Number(e.target.value) : null })}
                  placeholder="No limit"
                  className={inputClass}
                />
              </label>
            )}
            <div className="w-full space-y-1.5 sm:pl-24">
              <label className="block">
                <span className={labelClass}>Theme (optional)</span>
                <input
                  name={`round${i + 1}Theme`}
                  value={r.theme ?? ""}
                  onChange={(e) => change(i, { theme: e.target.value })}
                  maxLength={MAX_THEME_LENGTH}
                  placeholder="Blank for no theme, e.g. 90s Bollywood"
                  className={inputClass}
                />
              </label>
              {r.theme?.trim() && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={`round${i + 1}ThemeRequired`}
                    checked={r.themeRequired}
                    onChange={(e) => change(i, { themeRequired: e.target.checked })}
                  />
                  Songs must fit the theme (untick to make it a suggestion)
                </label>
              )}
            </div>
          </fieldset>
        ))}
      </div>
      <p className="text-xs text-ink-muted">
        Each singer picks one song per round. In a solo-or-duet round the singer chooses. The singing order says how
        singers get their slot in that round once they check in: they pick one, they go in the order they arrived,
        or the first to pay sings first. In a round with duets, &ldquo;Times per singer&rdquo; caps how often one
        person sings in it, counting their own song and the duets they&apos;re picked for; leave it blank for no
        limit. A round&apos;s theme is optional; leave it blank for anything goes.
      </p>
    </div>
  );
}
