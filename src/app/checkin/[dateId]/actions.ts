"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { CAN_CHECK_IN, PASS_COOKIE, checkInIsOpen, passIsValid } from "@/lib/checkin";
import type { FormState } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { requireViewer } from "@/lib/roles";
import { settle, withDateLock } from "@/lib/signups";
import { roundsFor } from "@/lib/rounds";
import { freeSlots, passedUpTo, slotCount, slotModeFor } from "@/lib/slots";

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
    const mode = slotModeFor(roundsFor(date, date.series), round);
    if (mode == null) return { error: "This event doesn't have that round." };
    if (mode !== "PICK") return { error: "Slots for this round are given out automatically when you check in." };
    const signUp = await tx.signUp.findUnique({
      where: { eventDateId_userId: { eventDateId: dateId, userId: viewer.id } },
    });
    if (!signUp || signUp.role !== "SINGER" || !CAN_CHECK_IN.includes(signUp.status)) {
      return { error: "Only singers signed up for this event can pick a slot." };
    }
    if (!signUp.checkedInAt) return { error: "Check in at the venue first, then pick your slot." };
    const passed = passedUpTo(date, round);
    if (passed === Infinity) return { error: `Round ${round} is over.` };
    const inRound = await tx.roundSlot.findMany({ where: { eventDateId: dateId, round } });
    const mine = inRound.find((s) => s.signUpId === signUp.id);
    if (mine?.slot === slot) return { ok: `You're in slot ${slot}.` };
    if (mine && mine.slot <= passed) return { error: `Your turn in round ${round} has already come up.` };
    if (slot <= passed) return { error: `Round ${round} is already past slot ${slot}. Pick a later one.` };
    if (inRound.some((s) => s.slot === slot)) return { error: `Slot ${slot} was just taken. Pick another.` };
    const free = freeSlots(
      inRound.map((s) => s.slot),
      await slotCount(tx, dateId),
      passed,
    );
    if (!free.includes(slot)) return { error: "That slot doesn't exist. Pick another." };
    await tx.roundSlot.deleteMany({ where: { signUpId: signUp.id, round } });
    await tx.roundSlot.create({ data: { eventDateId: dateId, round, slot, signUpId: signUp.id, method: "PICK" } });
    return { ok: `You're in slot ${slot}.` };
  });
  refresh(dateId);
  return result;
}
