"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { CAN_CHECK_IN, PASS_COOKIE, checkInIsOpen, passIsValid } from "@/lib/checkin";
import type { FormState } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { requireViewer } from "@/lib/roles";
import { settle, withDateLock } from "@/lib/signups";
import { ROUNDS, slotCount, slotModeFor } from "@/lib/slots";

/** Checks the signed-in guest in, at the server's time, if this browser just scanned the venue code. */
export async function checkInAtVenue(dateId: string): Promise<FormState> {
  const viewer = await requireViewer(`/checkin/${dateId}`);
  const date = await prisma.eventDate.findUnique({ where: { id: dateId } });
  if (!date || !checkInIsOpen(date)) return { error: "Check-in for this event isn't open." };
  const jar = await cookies();
  if (!passIsValid(dateId, date.checkInSecret!, jar.get(PASS_COOKIE)?.value)) {
    return { error: "Your scan has expired. Scan the code on the check-in screen again." };
  }
  const signUp = await prisma.signUp.findUnique({
    where: { eventDateId_userId: { eventDateId: dateId, userId: viewer.id } },
  });
  if (!signUp || !CAN_CHECK_IN.includes(signUp.status)) {
    return { error: "We couldn't find a sign-up for you. Please talk to the organizers." };
  }
  // Only the first check-in counts; a second scan keeps the original time.
  await prisma.signUp.updateMany({
    where: { id: signUp.id, checkedInAt: null },
    data: { checkedInAt: new Date(), checkInMethod: "SCAN", checkedInById: null },
  });
  // One pass, one check-in: someone else on this phone has to scan again.
  jar.delete({ name: PASS_COOKIE, path: "/checkin" });
  // Hands out check-in-order slots.
  await settle(dateId);
  refresh(dateId);
  return { ok: "checked-in" };
}

function refresh(dateId: string) {
  revalidatePath(`/checkin/${dateId}`);
  revalidatePath(`/admin/dates/${dateId}`);
  revalidatePath("/g/[slug]/[event]", "page");
}

/** A checked-in singer picks (or changes) their slot in a round where singers pick. */
export async function pickSlot(dateId: string, round: number, _prev: FormState, form: FormData): Promise<FormState> {
  const viewer = await requireViewer(`/checkin/${dateId}`);
  const slot = Number(form.get("slot"));
  if (!Number.isInteger(slot) || slot < 1) return { error: "Choose a slot." };
  const result = await withDateLock(dateId, async (tx): Promise<FormState> => {
    const date = await tx.eventDate.findUnique({ where: { id: dateId }, include: { series: true } });
    if (!date || date.status !== "SCHEDULED" || date.endsAt < new Date()) return { error: "This event is over." };
    if (!ROUNDS.includes(round as 1 | 2) || slotModeFor(date.series, round) !== "PICK") {
      return { error: "Slots for this round are given out automatically when you check in." };
    }
    const signUp = await tx.signUp.findUnique({
      where: { eventDateId_userId: { eventDateId: dateId, userId: viewer.id } },
    });
    if (!signUp || signUp.role !== "SINGER" || !CAN_CHECK_IN.includes(signUp.status)) {
      return { error: "Only singers signed up for this event can pick a slot." };
    }
    if (!signUp.checkedInAt) return { error: "Check in at the venue first, then pick your slot." };
    const count = await slotCount(tx, dateId);
    if (slot > count) return { error: "That slot doesn't exist. Pick another." };
    const holder = await tx.roundSlot.findUnique({
      where: { eventDateId_round_slot: { eventDateId: dateId, round, slot } },
    });
    if (holder && holder.signUpId !== signUp.id) return { error: `Slot ${slot} was just taken. Pick another.` };
    if (holder) return { ok: `You're in slot ${slot}.` };
    await tx.roundSlot.deleteMany({ where: { signUpId: signUp.id, round } });
    await tx.roundSlot.create({ data: { eventDateId: dateId, round, slot, signUpId: signUp.id, method: "PICK" } });
    return { ok: `You're in slot ${slot}.` };
  });
  refresh(dateId);
  return result;
}
