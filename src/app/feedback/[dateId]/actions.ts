"use server";

import { revalidatePath } from "next/cache";
import { FormError, type FormState, optionalText } from "@/lib/forms";
import { canSeeEvent, feedbackOpen, feedbackPath, MAX_COMMENT } from "@/lib/feedback";
import { prisma } from "@/lib/prisma";
import { requireViewer } from "@/lib/roles";

/** Saves the person's rating and comment for an event date that has ended, replacing any earlier response. */
export async function sendFeedback(
  dateId: string,
  privateKey: string | null,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const viewer = await requireViewer(feedbackPath(dateId, privateKey));
  try {
    const date = await prisma.eventDate.findUnique({ where: { id: dateId }, include: { series: true } });
    if (!date || date.status === "DELETED" || !(await canSeeEvent(viewer, date, privateKey))) {
      throw new FormError("This event no longer exists.");
    }
    if (!feedbackOpen(date)) throw new FormError("Feedback opens once the event is over.");
    const rating = Number(form.get("rating"));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new FormError("Pick a rating from 1 to 5 stars.");
    const comment = optionalText(form, "comment", { max: MAX_COMMENT });

    const existing = await prisma.eventFeedback.findUnique({
      where: { eventDateId_userId: { eventDateId: dateId, userId: viewer.id } },
      select: { id: true },
    });
    await prisma.eventFeedback.upsert({
      where: { eventDateId_userId: { eventDateId: dateId, userId: viewer.id } },
      create: { eventDateId: dateId, userId: viewer.id, rating, comment },
      update: { rating, comment },
    });
    revalidatePath("/feedback/[dateId]", "page");
    revalidatePath("/g/[slug]/[event]", "page");
    revalidatePath("/admin/dates/[dateId]", "layout");
    return { ok: existing ? "Thanks! Your feedback is updated." : "Thanks for your feedback!" };
  } catch (e) {
    if (e instanceof FormError) return { error: e.message };
    throw e;
  }
}
