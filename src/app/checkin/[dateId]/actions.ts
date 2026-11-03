"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { CAN_CHECK_IN, PASS_COOKIE, checkInIsOpen, passIsValid } from "@/lib/checkin";
import type { FormState } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { requireViewer } from "@/lib/roles";

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
  revalidatePath(`/checkin/${dateId}`);
  revalidatePath(`/admin/dates/${dateId}`);
  revalidatePath("/g/[slug]/[event]", "page");
  return { ok: "checked-in" };
}
