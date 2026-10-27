"use server";

import { randomBytes } from "node:crypto";
import { Prisma, type Frequency, type Visibility } from "@prisma/client";
import { OVERRIDE_KEYS, type OverrideKey } from "@/lib/events";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireGroupAdmin, requireSuperUser } from "@/lib/roles";
import { syncSeriesDates, timesFor } from "@/lib/schedule";
import {
  FormError,
  type FormState,
  hm,
  optionalCap,
  optionalText,
  optionalUrl,
  price,
  slugify,
  text,
  ymd,
} from "@/lib/forms";

async function attempt(
  fn: () => Promise<void>,
  duplicate = "That web address is already taken. Try another.",
): Promise<FormState> {
  try {
    await fn();
    return undefined;
  } catch (e) {
    if (e instanceof FormError) return { error: e.message };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: duplicate };
    throw e;
  }
}

/** Theme is optional; when set, the admin says whether songs must fit it. */
function themeFields(form: FormData) {
  return {
    theme: optionalText(form, "theme", { max: 120 }),
    themeRequired: form.get("themeRequired") === "on",
  };
}

// ---------- Groups ----------

function groupFields(form: FormData) {
  const name = text(form, "name", "Name", { max: 80 });
  const slug = slugify(optionalText(form, "slug") ?? name);
  if (!slug) throw new FormError("Web address needs at least one letter or number.");
  return {
    name,
    slug,
    description: optionalText(form, "description", { max: 1000 }),
    bannerUrl: optionalUrl(form, "bannerUrl", "Banner image"),
    zelleName: optionalText(form, "zelleName", { max: 100 }),
    zelleHandle: optionalText(form, "zelleHandle", { max: 100 }),
  };
}

function emailsIn(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Users for the given emails; they must have signed in once so their Google account is linked. */
async function usersByEmail(emails: string[]) {
  if (emails.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { OR: emails.map((e) => ({ email: { equals: e, mode: "insensitive" as const } })) },
    select: { id: true, email: true },
  });
  const found = new Set(users.map((u) => u.email?.toLowerCase()));
  const missing = emails.filter((e) => !found.has(e));
  if (missing.length) {
    throw new FormError(
      `No account for ${missing.join(", ")}. Ask them to sign in to the site once with Google, then add them.`,
    );
  }
  return users;
}

export async function createGroup(_prev: FormState, form: FormData): Promise<FormState> {
  await requireSuperUser();
  let id = "";
  const result = await attempt(async () => {
    const data = groupFields(form);
    const admins = await usersByEmail(emailsIn(String(form.get("adminEmails") ?? "")));
    const group = await prisma.group.create({
      data: { ...data, admins: { create: admins.map((u) => ({ userId: u.id })) } },
    });
    id = group.id;
  });
  if (result) return result;
  redirect(`/admin/groups/${id}`);
}

export async function updateGroup(groupId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireGroupAdmin(groupId);
  const result = await attempt(async () => {
    await prisma.group.update({ where: { id: groupId }, data: groupFields(form) });
  });
  if (result) return result;
  revalidatePath(`/admin/groups/${groupId}`);
  return { ok: "Saved." };
}

export async function deleteGroup(groupId: string): Promise<void> {
  await requireSuperUser();
  await prisma.group.delete({ where: { id: groupId } });
  redirect("/admin");
}

export async function addGroupAdmin(groupId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireGroupAdmin(groupId);
  const result = await attempt(async () => {
    const emails = emailsIn(String(form.get("email") ?? ""));
    if (emails.length === 0) throw new FormError("Enter an email address.");
    const users = await usersByEmail(emails);
    await prisma.groupAdmin.createMany({
      data: users.map((u) => ({ groupId, userId: u.id })),
      skipDuplicates: true,
    });
  });
  if (result) return result;
  revalidatePath(`/admin/groups/${groupId}`);
  return { ok: "Added." };
}

export async function removeGroupAdmin(groupId: string, userId: string): Promise<void> {
  const viewer = await requireGroupAdmin(groupId);
  await prisma.groupAdmin.deleteMany({ where: { groupId, userId } });
  if (userId === viewer.id && !viewer.isSuperUser) redirect("/admin");
  revalidatePath(`/admin/groups/${groupId}`);
}

// ---------- Event series ----------

const FREQUENCIES: Frequency[] = ["ONCE", "WEEKLY", "BIWEEKLY", "MONTHLY"];

function seriesFields(form: FormData) {
  const frequency = String(form.get("frequency")) as Frequency;
  if (!FREQUENCIES.includes(frequency)) throw new FormError("Pick how often the event repeats.");
  const visibility: Visibility = form.get("visibility") === "PRIVATE" ? "PRIVATE" : "PUBLIC";
  const firstDate = ymd(form, "firstDate", "First date")!;
  const endDate = frequency === "ONCE" ? null : ymd(form, "endDate", "End date", false);
  if (endDate && endDate < firstDate) throw new FormError("End date should be on or after the first date.");
  const week = String(form.get("monthlyWeekOfMonth") ?? "");
  const monthlyWeekOfMonth =
    frequency === "MONTHLY" && ["1", "2", "3", "4", "-1"].includes(week) ? Number(week) : null;
  const startTime = hm(form, "startTime", "Start time");
  const endTime = hm(form, "endTime", "End time");
  if (startTime === endTime) throw new FormError("End time should be different from the start time.");

  return {
    title: text(form, "title", "Title", { max: 120 }),
    description: optionalText(form, "description", { max: 2000 }),
    venueName: text(form, "venueName", "Venue name", { max: 120 }),
    venueAddress: text(form, "venueAddress", "Venue address", { max: 200 }),
    ...themeFields(form),
    visibility,
    frequency,
    monthlyWeekOfMonth,
    startTime,
    endTime,
    firstDate: new Date(`${firstDate}T00:00:00Z`),
    endDate: endDate ? new Date(`${endDate}T00:00:00Z`) : null,
    singerPriceCents: price(form, "singerPrice", "Singer price"),
    listenerPriceCents: price(form, "listenerPrice", "Listener price"),
    maxSingers: optionalCap(form, "maxSingers", "Singer cap"),
    maxListeners: optionalCap(form, "maxListeners", "Listener cap"),
    bannerUrl: optionalUrl(form, "bannerUrl", "Banner image"),
  };
}

function newPrivateToken(): string {
  // 10 characters from an alphabet without look-alikes; about 50 bits.
  const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
  return Array.from(randomBytes(10), (b) => alphabet[b % alphabet.length]).join("");
}

async function seriesGroup(seriesId: string): Promise<string> {
  const s = await prisma.eventSeries.findUnique({ where: { id: seriesId }, select: { groupId: true } });
  if (!s) throw new FormError("That event no longer exists.");
  return s.groupId;
}

export async function createSeries(groupId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireGroupAdmin(groupId);
  let id = "";
  const result = await attempt(async () => {
    const data = seriesFields(form);
    const series = await prisma.eventSeries.create({
      data: {
        ...data,
        groupId,
        privateToken: data.visibility === "PRIVATE" ? newPrivateToken() : null,
      },
    });
    id = series.id;
    await syncSeriesDates(series.id);
  });
  if (result) return result;
  redirect(`/admin/events/${id}`);
}

export async function updateSeries(seriesId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const groupId = await seriesGroup(seriesId);
  await requireGroupAdmin(groupId);
  const result = await attempt(async () => {
    const data = seriesFields(form);
    const before = await prisma.eventSeries.findUniqueOrThrow({ where: { id: seriesId } });
    await prisma.eventSeries.update({
      where: { id: seriesId },
      data: {
        ...data,
        privateToken: data.visibility === "PRIVATE" ? (before.privateToken ?? newPrivateToken()) : before.privateToken,
      },
    });
    // Dates follow these settings unless they override them, so there's nothing to copy.
    await syncSeriesDates(seriesId);
  });
  if (result) return result;
  revalidatePath(`/admin/events/${seriesId}`);
  return { ok: "Saved. Dates that don't override a setting now use the new one." };
}

export async function deleteSeries(seriesId: string): Promise<void> {
  const groupId = await seriesGroup(seriesId);
  await requireGroupAdmin(groupId);
  await prisma.eventSeries.delete({ where: { id: seriesId } });
  redirect(`/admin/groups/${groupId}`);
}

export async function resetPrivateLink(seriesId: string): Promise<void> {
  const groupId = await seriesGroup(seriesId);
  await requireGroupAdmin(groupId);
  await prisma.eventSeries.update({ where: { id: seriesId }, data: { privateToken: newPrivateToken() } });
  revalidatePath(`/admin/events/${seriesId}`);
}

// ---------- Single event dates ----------

async function dateGroup(dateId: string) {
  const d = await prisma.eventDate.findUnique({
    where: { id: dateId },
    select: {
      seriesId: true,
      startsAt: true,
      endsAt: true,
      originalStartsAt: true,
      series: { select: { groupId: true } },
    },
  });
  if (!d) throw new FormError("That date no longer exists.");
  return d;
}

export async function updateDate(dateId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const d = await dateGroup(dateId);
  await requireGroupAdmin(d.series.groupId);
  const result = await attempt(async () => {
    // Rescheduling: a new day or time moves this date and remembers the
    // schedule slot it came from, so the schedule doesn't put it back.
    const day = ymd(form, "date", "Date")!;
    const startTime = hm(form, "startTime", "Start time");
    const endTime = hm(form, "endTime", "End time");
    if (startTime === endTime) throw new FormError("End time should be different from the start time.");
    const { startsAt, endsAt } = timesFor({ startTime, endTime }, day);
    const moved = startsAt.getTime() !== d.startsAt.getTime() || endsAt.getTime() !== d.endsAt.getTime();
    const slot = d.originalStartsAt ?? d.startsAt;
    const originalStartsAt = !moved ? d.originalStartsAt : startsAt.getTime() === slot.getTime() ? null : slot;

    // Settings the admin chose to change for this date; the rest follow the event.
    const custom = form.getAll("custom").map(String);
    const overrides = OVERRIDE_KEYS.filter((k) => custom.includes(k));
    const own = (key: OverrideKey) => overrides.includes(key);

    await prisma.eventDate.update({
      where: { id: dateId },
      data: {
        startsAt,
        endsAt,
        originalStartsAt,
        overrides,
        ...(own("theme") ? themeFields(form) : { theme: null, themeRequired: true }),
        description: own("description") ? optionalText(form, "description", { max: 2000 }) : null,
        singerPriceCents: own("pricing") ? price(form, "singerPrice", "Singer price") : null,
        listenerPriceCents: own("pricing") ? price(form, "listenerPrice", "Listener price") : null,
        maxSingers: own("capacity") ? optionalCap(form, "maxSingers", "Singer cap") : null,
        maxListeners: own("capacity") ? optionalCap(form, "maxListeners", "Listener cap") : null,
        bannerUrl: optionalUrl(form, "bannerUrl", "Banner image"),
      },
    });
  }, "This event already has a date starting at that time.");
  if (result) return result;
  revalidatePath(`/admin/dates/${dateId}`);
  return { ok: "Saved." };
}

export async function setSignupsOpen(dateId: string, open: boolean): Promise<void> {
  const d = await dateGroup(dateId);
  await requireGroupAdmin(d.series.groupId);
  await prisma.eventDate.update({ where: { id: dateId }, data: { signupsOpen: open } });
  revalidatePath(`/admin/dates/${dateId}`);
  revalidatePath(`/admin/events/${d.seriesId}`);
}

export async function cancelDate(dateId: string): Promise<void> {
  const d = await dateGroup(dateId);
  await requireGroupAdmin(d.series.groupId);
  // Spec: cancelling hides the date and cancels every sign-up. Refunds happen outside the app.
  await prisma.$transaction([
    prisma.eventDate.update({ where: { id: dateId }, data: { status: "CANCELLED", signupsOpen: false } }),
    prisma.signUp.updateMany({ where: { eventDateId: dateId }, data: { status: "CANCELLED" } }),
  ]);
  revalidatePath(`/admin/dates/${dateId}`);
}

export async function restoreDate(dateId: string): Promise<void> {
  const d = await dateGroup(dateId);
  await requireGroupAdmin(d.series.groupId);
  await prisma.eventDate.update({ where: { id: dateId }, data: { status: "SCHEDULED" } });
  revalidatePath(`/admin/dates/${dateId}`);
}

/**
 * Removes one date. The row stays as DELETED (hidden everywhere) so the
 * repeating schedule doesn't create that date again; its sign-ups are cancelled.
 */
export async function deleteDate(dateId: string): Promise<void> {
  const d = await dateGroup(dateId);
  await requireGroupAdmin(d.series.groupId);
  await prisma.$transaction([
    prisma.eventDate.update({ where: { id: dateId }, data: { status: "DELETED", signupsOpen: false } }),
    prisma.signUp.updateMany({ where: { eventDateId: dateId }, data: { status: "CANCELLED" } }),
  ]);
  redirect(`/admin/events/${d.seriesId}`);
}
