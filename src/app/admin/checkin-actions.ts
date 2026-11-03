"use server";

import { revalidatePath } from "next/cache";
import { CAN_CHECK_IN, canOpenCheckIn, checkInOpensAt, newCheckInSecret } from "@/lib/checkin";
import { FormError } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { requireGroupAdmin } from "@/lib/roles";
import { settle, withDateLock } from "@/lib/signups";

// Admin side of in-person check-in (src/lib/checkin.ts).

function refresh(dateId: string) {
  revalidatePath(`/admin/dates/${dateId}`);
  revalidatePath(`/checkin/${dateId}`);
  revalidatePath("/g/[slug]/[event]", "page");
}

async function adminDate(dateId: string) {
  const date = await prisma.eventDate.findUnique({ where: { id: dateId }, include: { series: { select: { groupId: true } } } });
  if (!date) throw new FormError("This date no longer exists.");
  const viewer = await requireGroupAdmin(date.series.groupId, `/admin/dates/${dateId}`);
  return { date, viewer };
}

/**
 * Opens check-in, from an hour before the start until the end. Each opening
 * gets a new secret, so codes from an earlier opening never work again.
 */
export async function openCheckIn(dateId: string): Promise<void> {
  const { date } = await adminDate(dateId);
  if (!canOpenCheckIn(date)) return; // the button only shows inside the window
  await prisma.eventDate.update({
    where: { id: dateId },
    data: { checkInOpenedAt: new Date(), checkInSecret: newCheckInSecret() },
  });
  refresh(dateId);
}

/** Closes check-in. Codes on the screen, and scans not yet finished, stop working. */
export async function closeCheckIn(dateId: string): Promise<void> {
  await adminDate(dateId);
  await prisma.eventDate.update({ where: { id: dateId }, data: { checkInOpenedAt: null, checkInSecret: null } });
  refresh(dateId);
}

async function adminSignUp(signUpId: string) {
  const signUp = await prisma.signUp.findUnique({ where: { id: signUpId } });
  if (!signUp) throw new FormError("That sign-up no longer exists.");
  const { date, viewer } = await adminDate(signUp.eventDateId);
  return { signUp, date, viewer };
}

/** Checks someone in by hand (no phone, wrong account). Allowed from an hour before the start. */
export async function adminCheckIn(signUpId: string): Promise<void> {
  const { signUp, date, viewer } = await adminSignUp(signUpId);
  if (!CAN_CHECK_IN.includes(signUp.status) || new Date() < checkInOpensAt(date)) return;
  await prisma.signUp.updateMany({
    where: { id: signUpId, checkedInAt: null },
    data: { checkedInAt: new Date(), checkInMethod: "ADMIN", checkedInById: viewer.id },
  });
  await settle(signUp.eventDateId); // hands out check-in-order slots
  refresh(signUp.eventDateId);
}

/** Undoes a check-in, for example one made by mistake or from somewhere other than the venue. Frees their slots. */
export async function undoCheckIn(signUpId: string): Promise<void> {
  const { signUp } = await adminSignUp(signUpId);
  await withDateLock(signUp.eventDateId, async (tx) => {
    await tx.signUp.update({
      where: { id: signUpId },
      data: { checkedInAt: null, checkInMethod: null, checkedInById: null },
    });
    await tx.roundSlot.deleteMany({ where: { signUpId } });
  });
  refresh(signUp.eventDateId);
}

/** Frees a singer's slot in a round where singers pick, so they (or someone else) can pick it again. */
export async function clearSlot(signUpId: string, round: number): Promise<void> {
  const { signUp } = await adminSignUp(signUpId);
  await prisma.roundSlot.deleteMany({ where: { signUpId, round, method: "PICK" } });
  refresh(signUp.eventDateId);
}

// ---------- Now singing ----------

/** Every taken slot on the date, in singing order: round 1 by slot, then round 2. */
async function singingOrder(dateId: string) {
  return prisma.roundSlot.findMany({
    where: { eventDateId: dateId, signUp: { status: { in: CAN_CHECK_IN } } },
    orderBy: [{ round: "asc" }, { slot: "asc" }],
    select: { round: true, slot: true },
  });
}

/** Marks one slot as singing now. */
export async function setNowSinging(dateId: string, round: number, slot: number): Promise<void> {
  await adminDate(dateId);
  await prisma.eventDate.update({ where: { id: dateId }, data: { nowRound: round, nowSlot: slot } });
  refresh(dateId);
}

/** Moves "now singing" to the next (or previous) taken slot, across rounds. Past the last one, it clears. */
export async function stepNowSinging(dateId: string, step: 1 | -1): Promise<void> {
  const { date } = await adminDate(dateId);
  const order = await singingOrder(dateId);
  // Position of the current singer; when that slot was freed, the first slot after it.
  const at = order.findIndex(
    (o) => date.nowRound != null && (o.round > date.nowRound || (o.round === date.nowRound && o.slot >= (date.nowSlot ?? 0))),
  );
  const exact = at >= 0 && order[at].round === date.nowRound && order[at].slot === date.nowSlot;
  let next: number;
  if (date.nowRound == null) next = step === 1 ? 0 : -1;
  else if (at < 0) next = step === 1 ? order.length : order.length - 1;
  else next = step === 1 ? (exact ? at + 1 : at) : at - 1;
  const target = order[next];
  await prisma.eventDate.update({
    where: { id: dateId },
    data: target ? { nowRound: target.round, nowSlot: target.slot } : { nowRound: null, nowSlot: null },
  });
  refresh(dateId);
}

/**
 * Starts a round: the first taken slot in it becomes "now singing", whatever
 * its number. If that's #7, slots 1 to 6 can no longer be picked or given out.
 */
export async function startRound(dateId: string, round: number): Promise<void> {
  await adminDate(dateId);
  const first = (await singingOrder(dateId)).find((o) => o.round === round);
  if (!first) return;
  await prisma.eventDate.update({ where: { id: dateId }, data: { nowRound: round, nowSlot: first.slot } });
  refresh(dateId);
}

export async function clearNowSinging(dateId: string): Promise<void> {
  await adminDate(dateId);
  await prisma.eventDate.update({ where: { id: dateId }, data: { nowRound: null, nowSlot: null } });
  refresh(dateId);
}
