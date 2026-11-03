import type { Prisma, SlotMode } from "@prisma/client";
import { HOLDS_SPOT } from "@/lib/events";
import { type RoundConfig, roundAt, roundNumbers } from "@/lib/rounds";

// Singing slots: a singer's place in a round's running order, handed out
// only after they check in at the venue. Each round (src/lib/rounds.ts) has a mode:
//   PICK          – the singer picks any free slot (and can change it)
//   CHECKIN_ORDER – singers go in the order they check in
//   PAYMENT_ORDER – singers go in the order they paid (see paidAt)
// In a pick round there are as many slots as singers holding a spot on the
// date; in a check-in-order round each new arrival goes after the last one;
// in a payment-order round each singer's slot is their place in the payment
// order, so a no-show leaves a gap that "Next singer" skips.
// Undoing a check-in or ending a sign-up frees that person's slots.

type Tx = Prisma.TransactionClient;

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

/** The slot mode of round n, or null when the event has no such round. */
export function slotModeFor(rounds: RoundConfig[], round: number): SlotMode | null {
  return roundAt(rounds, round)?.slotMode ?? null;
}

/** How many slots each round has: one per singer holding a spot. */
export async function slotCount(tx: Tx, dateId: string): Promise<number> {
  return tx.signUp.count({ where: { eventDateId: dateId, role: "SINGER", status: { in: HOLDS_SPOT } } });
}

export type NowSinging = { nowRound: number | null; nowSlot: number | null };

/**
 * The highest slot in a round whose turn has come: 0 before the round starts,
 * the current slot while it runs, and Infinity once a later round has started.
 * Nobody can pick or be given a slot at or below it, so if the first singer
 * is #7, slots 1 to 6 are gone for good.
 */
export function passedUpTo(now: NowSinging, round: number): number {
  if (now.nowRound == null || now.nowRound < round) return 0;
  return now.nowRound > round ? Infinity : (now.nowSlot ?? 0);
}

/**
 * Slot numbers in a round nobody holds and whose turn hasn't come, from 1 to
 * the round's size. Each empty slot already passed adds one at the end, so
 * there is still a slot for everyone.
 */
export function freeSlots(taken: number[], count: number, passed = 0): number[] {
  if (passed === Infinity) return [];
  const used = new Set(taken);
  let size = Math.max(count, 0);
  for (let n = 1; n <= passed; n++) if (!used.has(n)) size++;
  const free: number[] = [];
  for (let n = passed + 1; n <= size; n++) if (!used.has(n)) free.push(n);
  return free;
}

/**
 * Gives every checked-in singer without a slot in an automatic round a slot.
 * Call inside withDateLock.
 *   Check-in order: the slot after the last one handed out, earliest check-in
 *   first. A slot freed by a cancellation is skipped rather than refilled,
 *   since that turn may already have passed.
 *   Payment order: their place among the date's singers by paidAt (1 = paid
 *   first), or the next free number if that one is held. A singer who checks
 *   in after "now singing" has reached or passed their place goes to the end.
 *   Either way, nobody gets a slot whose turn has passed, and nobody gets a
 *   slot in a round that's over.
 */
export async function fillCheckInOrderSlots(
  tx: Tx,
  dateId: string,
  config: RoundConfig[],
  now: NowSinging = { nowRound: null, nowSlot: null },
) {
  const rounds = roundNumbers(config).filter((r) => AUTO_MODES.includes(slotModeFor(config, r)!));
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
    const mode = slotModeFor(config, round)!;
    const inRound = slots.filter((s) => s.round === round);
    const hasSlot = new Set(inRound.map((s) => s.signUpId));
    const taken = new Set(inRound.map((s) => s.slot));
    let last = Math.max(0, ...taken);
    for (const singer of arrived) {
      if (hasSlot.has(singer.id)) continue;
      let slot: number;
      const passed = passedUpTo(now, round);
      if (passed === Infinity) continue; // the round is over
      if (mode === "PAYMENT_ORDER") {
        const place = paymentPlace.get(singer.id)!;
        // Arriving after their turn has come up sends them to the end, after
        // every payment place; otherwise they keep it.
        slot = place <= passed ? Math.max(last, singers.length, passed) + 1 : place;
        while (taken.has(slot)) slot++;
      } else {
        slot = Math.max(last, passed) + 1;
      }
      last = Math.max(last, slot);
      taken.add(slot);
      await tx.roundSlot.create({ data: { eventDateId: dateId, round, slot, signUpId: singer.id, method: mode } });
    }
  }
}

export type RoundSlotInfo = {
  round: number;
  mode: SlotMode;
  mySlot: number | null;
  free: number[];
  /** "upcoming", "running" (now singing is in this round) or "over" (a later round started). */
  stage: "upcoming" | "running" | "over";
  /** True when this singer's slot has had its turn, so it can't be changed. */
  myTurnPassed: boolean;
};

/** Each round's mode, this singer's slot, and the slots still free, for the slot picker. */
export async function singerRounds(
  tx: Tx,
  dateId: string,
  signUpId: string,
  config: RoundConfig[],
  now: NowSinging,
): Promise<RoundSlotInfo[]> {
  const [slots, count] = await Promise.all([
    tx.roundSlot.findMany({ where: { eventDateId: dateId }, select: { round: true, slot: true, signUpId: true } }),
    slotCount(tx, dateId),
  ]);
  return roundNumbers(config).map((round) => {
    const inRound = slots.filter((s) => s.round === round);
    const passed = passedUpTo(now, round);
    const mySlot = inRound.find((s) => s.signUpId === signUpId)?.slot ?? null;
    return {
      round,
      mode: slotModeFor(config, round)!,
      mySlot,
      free: freeSlots(
        inRound.map((s) => s.slot),
        count,
        passed,
      ),
      stage: passed === Infinity ? "over" : passed > 0 ? "running" : "upcoming",
      myTurnPassed: mySlot != null && mySlot <= passed,
    };
  });
}
