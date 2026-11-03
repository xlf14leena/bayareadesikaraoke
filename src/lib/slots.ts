import type { EventSeries, Prisma, SlotMode } from "@prisma/client";
import { HOLDS_SPOT } from "@/lib/events";

// Singing slots: a singer's place in a round's running order, handed out
// only after they check in at the venue. Each round of a series has a mode:
//   PICK          – the singer picks any free slot (and can change it)
//   CHECKIN_ORDER – singers go in the order they check in
// In a pick round there are as many slots as singers holding a spot on the
// date; in a check-in-order round each new arrival goes after the last one.
// Undoing a check-in or ending a sign-up frees that person's slots.

type Tx = Prisma.TransactionClient;

export const ROUNDS = [1, 2] as const;

export const SLOT_MODE_LABEL: Record<SlotMode, string> = {
  PICK: "Singers pick a slot",
  CHECKIN_ORDER: "Check-in order",
};

export function slotModeFor(series: Pick<EventSeries, "round1SlotMode" | "round2SlotMode">, round: number): SlotMode {
  return round === 1 ? series.round1SlotMode : series.round2SlotMode;
}

/** How many slots each round has: one per singer holding a spot. */
export async function slotCount(tx: Tx, dateId: string): Promise<number> {
  return tx.signUp.count({ where: { eventDateId: dateId, role: "SINGER", status: { in: HOLDS_SPOT } } });
}

/** Slot numbers in a round nobody holds, from 1 to the round's size. */
export function freeSlots(taken: number[], count: number): number[] {
  const used = new Set(taken);
  const free: number[] = [];
  for (let n = 1; n <= Math.max(count, 0); n++) if (!used.has(n)) free.push(n);
  return free;
}

/**
 * Gives every checked-in singer without a slot in a check-in-order round the
 * slot after the last one handed out, earliest check-in first. A slot freed
 * by a cancellation is skipped rather than refilled, since that turn may
 * already have passed. Call inside withDateLock.
 */
export async function fillCheckInOrderSlots(
  tx: Tx,
  dateId: string,
  series: Pick<EventSeries, "round1SlotMode" | "round2SlotMode">,
) {
  const rounds = ROUNDS.filter((r) => slotModeFor(series, r) === "CHECKIN_ORDER");
  if (rounds.length === 0) return;
  const singers = await tx.signUp.findMany({
    where: { eventDateId: dateId, role: "SINGER", status: { in: HOLDS_SPOT }, checkedInAt: { not: null } },
    orderBy: [{ checkedInAt: "asc" }, { registeredAt: "asc" }],
    select: { id: true },
  });
  if (singers.length === 0) return;
  const slots = await tx.roundSlot.findMany({ where: { eventDateId: dateId, round: { in: [...rounds] } } });
  for (const round of rounds) {
    const inRound = slots.filter((s) => s.round === round);
    const hasSlot = new Set(inRound.map((s) => s.signUpId));
    let last = Math.max(0, ...inRound.map((s) => s.slot));
    for (const singer of singers) {
      if (hasSlot.has(singer.id)) continue;
      last += 1;
      await tx.roundSlot.create({
        data: { eventDateId: dateId, round, slot: last, signUpId: singer.id, method: "CHECKIN_ORDER" },
      });
    }
  }
}

export type RoundSlotInfo = { round: number; mode: SlotMode; mySlot: number | null; free: number[] };

/** Each round's mode, this singer's slot, and the slots still free, for the slot picker. */
export async function singerRounds(
  tx: Tx,
  dateId: string,
  signUpId: string,
  series: Pick<EventSeries, "round1SlotMode" | "round2SlotMode">,
): Promise<RoundSlotInfo[]> {
  const [slots, count] = await Promise.all([
    tx.roundSlot.findMany({ where: { eventDateId: dateId }, select: { round: true, slot: true, signUpId: true } }),
    slotCount(tx, dateId),
  ]);
  return ROUNDS.map((round) => {
    const inRound = slots.filter((s) => s.round === round);
    return {
      round,
      mode: slotModeFor(series, round),
      mySlot: inRound.find((s) => s.signUpId === signUpId)?.slot ?? null,
      free: freeSlots(
        inRound.map((s) => s.slot),
        count,
      ),
    };
  });
}
