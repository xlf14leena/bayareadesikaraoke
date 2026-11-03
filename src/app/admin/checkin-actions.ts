"use server";

import { revalidatePath } from "next/cache";
import { CAN_CHECK_IN, canOpenCheckIn, checkInOpensAt, newCheckInSecret } from "@/lib/checkin";
import { FormError } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { requireGroupAdmin } from "@/lib/roles";

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
  refresh(signUp.eventDateId);
}

/** Undoes a check-in, for example one made by mistake or from somewhere other than the venue. */
export async function undoCheckIn(signUpId: string): Promise<void> {
  const { signUp } = await adminSignUp(signUpId);
  await prisma.signUp.update({
    where: { id: signUpId },
    data: { checkedInAt: null, checkInMethod: null, checkedInById: null },
  });
  refresh(signUp.eventDateId);
}
