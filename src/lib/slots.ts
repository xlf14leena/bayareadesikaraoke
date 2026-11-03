import type { EventSeries, Prisma, SlotMode } from "@prisma/client";
import { HOLDS_SPOT } from "@/lib/events";

// Singing slots: a singer's place in a round's running order, handed out
// only after they check in at the venue. Each round of a series has a mode:
//   PICK          – the singer picks any free slot (and can change it)
//   CHECKIN_ORDER – singers go in the order they check in
//   PAYMENT_ORDER – singers go in the order they paid (see paidAt)
// In a pick round there are as many slots as singers holding a spot on the
// date; in a check-in-order round each new arrival goes after the last one;
// in a payment-order round each singer's slot is their place in the payment
// order, so a no-show leaves a gap that "Next singer" skips.
// Undoing a check-in or ending a sign-up frees that person's slots.

type Tx = Prisma.TransactionClient;

export const ROUNDS = [1, 2] as const;

export const SLOT_MODE_LABEL: Record<SlotMode, string> = {
  PICK: "Singers pick a slot",
  CHECKIN_ORDER: "Check-in order",
  PAYMENT_ORDER: "Payment order",
};

/** Modes where slots are handed out automatically when a singer checks in. */
const AUTO_MODES: SlotMode[] = ["CHECKIN_ORDER", "PAYMENT_ORDER"];

type PaidFields = {
  status: string;
  registeredAt: Date;
  reviewedAt: Date | null;
  screenshot: { uploadedAt: Date } | null;
};

/**
 * When a singer paid, for payment order: the time they sent the payment
 * screenshot that was approved. A free spot, or one an admin added or marked
 * paid by hand, counts from when it was confirmed. Anyone not confirmed yet
 * (payment still under review) goes after everyone who is.
 */
export function paidAt(s: PaidFields): number {
  if (s.status !== "CONFIRMED") return Number.MAX_SAFE_INTEGER;
  return (s.screenshot?.uploadedAt ?? s.reviewedAt ?? s.registeredAt).getTime();
}

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
 * Gives every checked-in singer without a slot in an automatic round a slot.
 * Call inside withDateLock.
 *   Check-in order: the slot after the last one handed out, earliest check-in
 *   first. A slot freed by a cancellation is skipped rather than refilled,
 *   since that turn may already have passed.
 *   Payment order: their place among the date's singers by paidAt (1 = paid
 *   first), or the next free number if that one is held.
 */
export async function fillCheckInOrderSlots(
  tx: Tx,
  dateId: string,
  series: Pick<EventSeries, "round1SlotMode" | "round2SlotMode">,
) {
  const rounds = ROUNDS.filter((r) => AUTO_MODES.includes(slotModeFor(series, r)));
  if (rounds.length === 0) return;
  const singers = await tx.signUp.findMany({
    where: { eventDateId: dateId, role: "SINGER", status: { in: HOLDS_SPOT } },
    orderBy: [{ checkedInAt: "asc" }, { registeredAt: "asc" }],
    select: {
      id: true,
      status: true,
      checkedInAt: true,
      registeredAt: true,
      reviewedAt: true,
      screenshot: { select: { uploadedAt: true } },
    },
  });
  const arrived = singers.filter((s) => s.checkedInAt);
  if (arrived.length === 0) return;
  const byPayment = [...singers].sort(
    (a, b) => paidAt(a) - paidAt(b) || a.registeredAt.getTime() - b.registeredAt.getTime(),
  );
  const paymentPlace = new Map(byPayment.map((s, i) => [s.id, i + 1]));
  const slots = await tx.roundSlot.findMany({ where: { eventDateId: dateId, round: { in: [...rounds] } } });
  for (const round of rounds) {
    const mode = slotModeFor(series, round);
    const inRound = slots.filter((s) => s.round === round);
    const hasSlot = new Set(inRound.map((s) => s.signUpId));
    const taken = new Set(inRound.map((s) => s.slot));
    let last = Math.max(0, ...taken);
    for (const singer of arrived) {
      if (hasSlot.has(singer.id)) continue;
      let slot: number;
      if (mode === "PAYMENT_ORDER") {
        slot = paymentPlace.get(singer.id)!;
        while (taken.has(slot)) slot++;
      } else {
        slot = last + 1;
      }
      last = Math.max(last, slot);
      taken.add(slot);
      await tx.roundSlot.create({ data: { eventDateId: dateId, round, slot, signUpId: singer.id, method: mode } });
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
