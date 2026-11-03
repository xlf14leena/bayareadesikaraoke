"use server";

import type { AttendeeRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { FormError, type FormState, text } from "@/lib/forms";
import { eventPathById } from "@/lib/event-url";
import { prisma } from "@/lib/prisma";
import { roundsFor } from "@/lib/rounds";
import { canAdminGroup, requireViewer } from "@/lib/roles";
import {
  ENDED,
  HOLD_MS,
  MAX_SCREENSHOT_BYTES,
  PICKS_SONGS,
  SCREENSHOT_TYPES,
  acceptingSignUps,
  capFor,
  heldCount,
  newMemoCode,
  priceFor,
  releaseSongs,
  setSong,
  settleDate,
  songInputs,
  stillEditable,
  withDateLock,
} from "@/lib/signups";

// Member actions on an event page (spec: "Sign-up and Zelle payment", "Songs").


async function attempt(fn: () => Promise<string | void>): Promise<FormState> {
  try {
    const ok = await fn();
    return ok ? { ok } : undefined;
  } catch (e) {
    if (e instanceof FormError) return { error: e.message, nearMatch: e.nearMatch };
    throw e;
  }
}

function refresh() {
  revalidatePath("/g/[slug]/[event]", "page");
  revalidatePath("/me");
}

/** Signs the person up as a singer or listener, or puts them on the waitlist when that role is full. */
export async function signUpForDate(
  dateId: string,
  privateKey: string | null,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const viewer = await requireViewer(await eventPathById(dateId));
  const result = await attempt(async () => {
    const date = await prisma.eventDate.findUnique({ where: { id: dateId }, include: { series: true } });
    if (!date || date.status === "DELETED") throw new FormError("This date no longer exists.");
    if (!acceptingSignUps(date)) throw new FormError("Sign-ups for this date are closed.");
    if (
      date.series.visibility === "PRIVATE" &&
      !canAdminGroup(viewer, date.series.groupId) &&
      privateKey !== date.series.privateToken
    ) {
      throw new FormError("This private event's link has changed. Ask the organizers for the new one.");
    }
    const rawRole = form.get("role");
    if (rawRole !== "SINGER" && rawRole !== "LISTENER") throw new FormError("Choose singer or listener.");
    const role: AttendeeRole = rawRole;
    const displayName = text(form, "displayName", "Your name", { max: 60 });

    return withDateLock(dateId, async (tx) => {
      await settleDate(tx, dateId);
      const existing = await tx.signUp.findUnique({
        where: { eventDateId_userId: { eventDateId: dateId, userId: viewer.id } },
      });
      if (existing && !ENDED.includes(existing.status)) throw new FormError("You're already signed up for this date.");

      const cap = capFor(date, role);
      const full = cap != null && (await heldCount(tx, dateId, role)) >= cap;
      const amount = priceFor(date, role);
      const now = new Date();
      const state = full
        ? { status: "WAITLISTED" as const, waitlistedAt: now, reservedUntil: null }
        : amount === 0
          ? { status: "CONFIRMED" as const, waitlistedAt: null, reservedUntil: null }
          : { status: "RESERVED" as const, waitlistedAt: null, reservedUntil: new Date(now.getTime() + HOLD_MS) };
      const data = {
        displayName,
        email: viewer.email,
        role,
        amountDueCents: amount,
        registeredAt: now,
        reviewedById: null,
        reviewedAt: null,
        reviewReason: null,
        paymentNote: null,
        ...state,
      };
      if (existing) {
        await tx.signUp.update({ where: { id: existing.id }, data });
        await tx.paymentScreenshot.deleteMany({ where: { signUpId: existing.id } });
      } else {
        await tx.signUp.create({
          data: { ...data, eventDateId: dateId, userId: viewer.id, memoCode: await newMemoCode(tx) },
        });
      }
      return full ? "You're on the waitlist." : "You're signed up.";
    });
  });
  refresh();
  return result;
}

async function ownSignUp(signUpId: string) {
  const signUp = await prisma.signUp.findUnique({ where: { id: signUpId }, include: { eventDate: { include: { series: true } } } });
  const viewer = await requireViewer(signUp ? await eventPathById(signUp.eventDateId) : "/me");
  if (!signUp || signUp.userId !== viewer.id) throw new FormError("That sign-up isn't yours.");
  return signUp;
}

/** Uploads (or replaces) the Zelle payment screenshot and sends the sign-up for review. */
export async function uploadScreenshot(signUpId: string, _prev: FormState, form: FormData): Promise<FormState> {
  let dateId = "";
  const result = await attempt(async () => {
    const signUp = await ownSignUp(signUpId);
    dateId = signUp.eventDateId;
    if (!stillEditable(signUp.eventDate)) throw new FormError("Sign-ups for this date are closed.");
    const file = form.get("screenshot");
    if (!(file instanceof File) || file.size === 0) throw new FormError("Choose a screenshot of your Zelle payment.");
    if (file.size > MAX_SCREENSHOT_BYTES) {
      throw new FormError("That image is too large. A phone screenshot of the payment works best.");
    }
    const type = file.type.toLowerCase();
    if (!SCREENSHOT_TYPES.includes(type)) throw new FormError("Upload a JPG, PNG or HEIC image.");
    const bytes = Buffer.from(await file.arrayBuffer());

    return withDateLock(dateId, async (tx) => {
      await settleDate(tx, dateId);
      const now = await tx.signUp.findUniqueOrThrow({ where: { id: signUpId } });
      if (!["RESERVED", "REJECTED", "UNDER_REVIEW"].includes(now.status)) {
        throw new FormError(
          now.status === "EXPIRED"
            ? "Your 24-hour hold ran out, so the spot was released. You can sign up again if spots are left."
            : "This sign-up doesn't need a payment screenshot.",
        );
      }
      await tx.paymentScreenshot.upsert({
        where: { signUpId },
        create: { signUpId, contentType: type, bytes },
        update: { contentType: type, bytes, uploadedAt: new Date() },
      });
      await tx.signUp.update({ where: { id: signUpId }, data: { status: "UNDER_REVIEW", reservedUntil: null } });
      return "Thanks! The organizers will check your payment.";
    });
  });
  if (dateId) refresh();
  return result;
}

/** Saves the singer's song for each round. */
export async function saveSongs(signUpId: string, _prev: FormState, form: FormData): Promise<FormState> {
  let dateId = "";
  const result = await attempt(async () => {
    const signUp = await ownSignUp(signUpId);
    dateId = signUp.eventDateId;
    if (signUp.role !== "SINGER") throw new FormError("Only singers pick songs.");
    if (!stillEditable(signUp.eventDate)) throw new FormError("Songs can't be changed after sign-ups close.");
    const inputs = songInputs(form, roundsFor(signUp.eventDate, signUp.eventDate.series));

    return withDateLock(dateId, async (tx) => {
      await settleDate(tx, dateId);
      const now = await tx.signUp.findUniqueOrThrow({ where: { id: signUpId } });
      if (!PICKS_SONGS.includes(now.status)) {
        throw new FormError(
          now.status === "WAITLISTED"
            ? "You can pick songs once you're off the waitlist."
            : "This sign-up no longer holds a spot, so it can't pick songs.",
        );
      }
      for (const [i, input] of inputs.entries()) await setSong(tx, now, i + 1, input);
      return "Songs saved.";
    });
  });
  if (dateId) refresh();
  return result;
}

/** Cancels the person's own sign-up or leaves the waitlist. Confirmed spots are cancelled by the organizers. */
export async function leaveSignUp(signUpId: string): Promise<void> {
  const signUp = await ownSignUp(signUpId);
  await withDateLock(signUp.eventDateId, async (tx) => {
    const now = await tx.signUp.findUniqueOrThrow({ where: { id: signUpId } });
    if (!["WAITLISTED", "RESERVED", "REJECTED", "UNDER_REVIEW"].includes(now.status)) return;
    await tx.signUp.update({ where: { id: signUpId }, data: { status: "CANCELLED", reservedUntil: null } });
    await releaseSongs(tx, [signUpId]);
    await settleDate(tx, signUp.eventDateId);
  });
  refresh();
}
