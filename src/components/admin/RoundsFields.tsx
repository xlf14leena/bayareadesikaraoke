"use client";

import { useState } from "react";
import type { SlotMode } from "@prisma/client";
import { inputClass, labelClass } from "@/components/ui";
import { MAX_ROUNDS, type RoundConfig, type RoundKind } from "@/lib/rounds";

/**
 * How many rounds an event has, and for each one solo/duet and how singers
 * get their slot. Posts "roundCount" and "round{n}Kind" / "round{n}SlotMode"
 * (read by roundsFromForm in src/lib/rounds.ts).
 */
export default function RoundsFields({ initial }: { initial: RoundConfig[] }) {
  const [count, setCount] = useState(initial.length);
  // Settings for every possible round, so lowering the count and raising it again keeps them.
  const [rounds, setRounds] = useState<RoundConfig[]>(() =>
    Array.from({ length: MAX_ROUNDS }, (_, i) => initial[i] ?? { kind: "EITHER", slotMode: "CHECKIN_ORDER" }),
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
          className={inputClass.replace("w-full", "w-20")}
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
          <fieldset key={i} className="grid gap-3 rounded-lg border border-line bg-mist/40 p-3 sm:grid-cols-[6rem_1fr_1fr] sm:items-end">
            <legend className="sr-only">Round {i + 1}</legend>
            <span aria-hidden className="font-semibold text-royal sm:pb-2">
              Round {i + 1}
            </span>
            <label className="block">
              <span className={labelClass}>Songs</span>
              <select
                name={`round${i + 1}Kind`}
                value={r.kind}
                onChange={(e) => change(i, { kind: e.target.value as RoundKind })}
                className={inputClass}
              >
                <option value="EITHER">Solo or duet (singer chooses)</option>
                <option value="SOLO">Solos only</option>
                <option value="DUET">Duets only</option>
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Singing order</span>
              <select
                name={`round${i + 1}SlotMode`}
                value={r.slotMode}
                onChange={(e) => change(i, { slotMode: e.target.value as SlotMode })}
                className={inputClass}
              >
                <option value="PICK">Singers pick a free slot</option>
                <option value="CHECKIN_ORDER">Check-in order</option>
                <option value="PAYMENT_ORDER">Payment order (first to pay sings first)</option>
              </select>
            </label>
          </fieldset>
        ))}
      </div>
      <p className="text-xs text-ink-muted">
        Each singer picks one song per round. The singing order says how singers get their slot in that round once
        they check in at the venue.
      </p>
    </div>
  );
}
