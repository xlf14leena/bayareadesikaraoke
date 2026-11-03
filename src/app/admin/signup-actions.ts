"use server";

import type { AttendeeRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { FormError, type FormState, optionalText, text } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { requireGroupAdmin } from "@/lib/roles";
import {
  ENDED,
  HOLD_MS,
  capFor,
  heldCount,
  newMemoCode,
  priceFor,
  releaseSongs,
  setSong,
  settleDate,
  songInput,
  withDateLock,
} from "@/lib/signups";

// Admin review of sign-ups (spec: "Admin review", "Admin-added people").

async function attempt(fn: () => Promise<string | void>): Promise<FormState> {
  try {
    const ok = await fn();
    return ok ? { ok } : undefined;
  } catch (e) {
    if (e instanceof FormError) return { error: e.message, nearMatch: e.nearMatch };
    throw e;
  }
}

/** The sign-up, after checking the viewer administers its group. */
async function adminSignUp(signUpId: string) {
  const signUp = await prisma.signUp.findUnique({
    where: { id: signUpId },
    include: { eventDate: { include: { series: { select: { groupId: true } } } } },
  });
  if (!signUp) throw new FormError("That sign-up no longer exists.");
  const viewer = await requireGroupAdmin(signUp.eventDate.series.groupId, `/admin/dates/${signUp.eventDateId}`);
  return { signUp, viewer };
}

function refresh(dateId: string) {
  revalidatePath(`/admin/dates/${dateId}`);
  revalidatePath("/g/[slug]/[event]", "page");
  revalidatePath("/me");
}

export async function approvePayment(signUpId: string): Promise<void> {
  const { signUp, viewer } = await adminSignUp(signUpId);
  await withDateLock(signUp.eventDateId, async (tx) => {
    const now = await tx.signUp.findUniqueOrThrow({ where: { id: signUpId } });
    if (!["UNDER_REVIEW", "REJECTED", "RESERVED"].includes(now.status)) return;
    await tx.signUp.update({
      where: { id: signUpId },
      data: { status: "CONFIRMED", reservedUntil: null, reviewedById: viewer.id, reviewedAt: new Date(), reviewReason: null },
    });
  });
  refresh(signUp.eventDateId);
}

/** Sends the payment back: the person has 24 hours to upload a new screenshot. */
export async function rejectPayment(signUpId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { signUp, viewer } = await adminSignUp(signUpId);
  const result = await attempt(async () => {
    const reason = text(form, "reason", "A reason", { max: 300 });
    await withDateLock(signUp.eventDateId, async (tx) => {
      const now = await tx.signUp.findUniqueOrThrow({ where: { id: signUpId } });
      if (now.status !== "UNDER_REVIEW") throw new FormError("This payment isn't waiting for review any more.");
      await tx.signUp.update({
        where: { id: signUpId },
        data: {
          status: "REJECTED",
          reviewReason: reason,
          reviewedById: viewer.id,
          reviewedAt: new Date(),
          reservedUntil: new Date(Date.now() + HOLD_MS),
        },
      });
    });
  });
  refresh(signUp.eventDateId);
  return result;
}

/** Cancels any sign-up, releasing its spot and songs to the waitlist. */
export async function cancelSignUp(signUpId: string): Promise<void> {
  const { signUp, viewer } = await adminSignUp(signUpId);
  await withDateLock(signUp.eventDateId, async (tx) => {
    const now = await tx.signUp.findUniqueOrThrow({ where: { id: signUpId } });
    if (ENDED.includes(now.status)) return;
    await tx.signUp.update({
      where: { id: signUpId },
      data: { status: "CANCELLED", reservedUntil: null, reviewedById: viewer.id, reviewedAt: new Date() },
    });
    await releaseSongs(tx, [signUpId]);
    await settleDate(tx, signUp.eventDateId);
  });
  refresh(signUp.eventDateId);
}

/** Turns down one song (for example, it doesn't fit the theme). The singer then picks another. */
export async function rejectSong(songId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const song = await prisma.song.findUnique({ where: { id: songId } });
  if (!song) return { error: "That song no longer exists." };
  await adminSignUp(song.signUpId);
  const result = await attempt(async () => {
    const reason = text(form, "reason", "A reason", { max: 300 });
    const updated = await prisma.song.updateMany({
      where: { id: songId, status: "ACTIVE" },
      data: { status: "REJECTED", rejectReason: reason, releasedAt: new Date() },
    });
    if (updated.count === 0) throw new FormError("That song was already changed.");
  });
  refresh(song.eventDateId);
  return result;
}

/** Adds someone by hand (paid in person, or doesn't use the site). Confirmed at once. */
export async function addPerson(dateId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const date = await prisma.eventDate.findUnique({ where: { id: dateId }, include: { series: true } });
  if (!date) return { error: "This date no longer exists." };
  const viewer = await requireGroupAdmin(date.series.groupId, `/admin/dates/${dateId}`);
  const result = await attempt(async () => {
    if (date.status !== "SCHEDULED") throw new FormError("This date is cancelled.");
    const displayName = text(form, "displayName", "Name", { max: 60 });
    const rawRole = form.get("role");
    if (rawRole !== "SINGER" && rawRole !== "LISTENER") throw new FormError("Choose singer or listener.");
    const role: AttendeeRole = rawRole;
    const email = optionalText(form, "email", { max: 120 })?.toLowerCase() ?? null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new FormError("That email address doesn't look right.");
    const paymentNote = optionalText(form, "paymentNote", { max: 120 });
    const overCap = form.get("overCap") === "on";
    const songs = role === "SINGER" ? [songInput(form, 1), songInput(form, 2)] : [null, null];

    return withDateLock(dateId, async (tx) => {
      await settleDate(tx, dateId);
      const cap = capFor(date, role);
      const held = await heldCount(tx, dateId, role);
      if (cap != null && held >= cap && !overCap) {
        throw new FormError(
          `${role === "SINGER" ? "Singers" : "Listeners"} are full (${held} of ${cap}). Tick "Go over the cap" to add them anyway.`,
        );
      }

      // Link to their account if they've signed in before; otherwise it links when they first sign in.
      const user = email
        ? await tx.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } })
        : null;
      const existing = user
        ? await tx.signUp.findUnique({ where: { eventDateId_userId: { eventDateId: dateId, userId: user.id } } })
        : null;
      if (existing && !ENDED.includes(existing.status)) {
        throw new FormError(`${email} is already signed up for this date.`);
      }
      const data = {
        displayName,
        email,
        role,
        status: "CONFIRMED" as const,
        amountDueCents: priceFor(date, role),
        registeredAt: new Date(),
        reservedUntil: null,
        waitlistedAt: null,
        addedByAdmin: true,
        paymentNote,
        reviewedById: viewer.id,
        reviewedAt: new Date(),
        reviewReason: null,
      };
      if (existing) await tx.paymentScreenshot.deleteMany({ where: { signUpId: existing.id } });
      const signUp = existing
        ? await tx.signUp.update({ where: { id: existing.id }, data })
        : await tx.signUp.create({
            data: { ...data, eventDateId: dateId, userId: user?.id ?? null, memoCode: await newMemoCode(tx) },
          });
      for (const [i, input] of songs.entries()) if (input) await setSong(tx, signUp, i + 1, input);
      return `Added ${displayName}.`;
    });
  });
  refresh(dateId);
  return result;
}
