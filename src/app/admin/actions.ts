"use server";

import { randomBytes } from "node:crypto";
import { Prisma, type Frequency, type SongLock, type Visibility } from "@prisma/client";
import { OVERRIDE_KEYS, SONG_LOCKS, type OverrideKey } from "@/lib/events";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireGroupAdmin, requireSuperUser } from "@/lib/roles";
import { dropReplacedBanner, withBanner } from "@/lib/banner-upload";
import { parseRounds, roundsFromForm } from "@/lib/rounds";
import { syncSeriesDates, timesFor } from "@/lib/schedule";
import { settle } from "@/lib/signups";
import {
  FormError,
  type FormState,
  hm,
  optionalCap,
  optionalLink,
  optionalText,
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

// ---------- Groups ----------

function groupFields(form: FormData) {
  const name = text(form, "name", "Name", { max: 80 });
  const slug = slugify(optionalText(form, "slug") ?? name);
  if (!slug) throw new FormError("Web address needs at least one letter or number.");
  return {
    name,
    slug,
    description: optionalText(form, "description", { max: 1000 }),
    websiteUrl: optionalLink(form, "websiteUrl", "Website"),
    facebookUrl: optionalLink(form, "facebookUrl", "Facebook page"),
    instagramUrl: optionalLink(form, "instagramUrl", "Instagram page"),
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
    await withBanner(form, null, (bannerUrl) =>
      withBanner(
        form,
        null,
        async (thumbnailUrl) => {
          const group = await prisma.group.create({
            data: { ...data, bannerUrl, thumbnailUrl, admins: { create: admins.map((u) => ({ userId: u.id })) } },
          });
          id = group.id;
        },
        { field: "thumbnail" },
      ),
    );
  });
  if (result) return result;
  redirect(`/admin/groups/${id}`);
}

export async function updateGroup(groupId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireGroupAdmin(groupId);
  const result = await attempt(async () => {
    const data = groupFields(form);
    const before = await prisma.group.findUniqueOrThrow({
      where: { id: groupId },
      select: { bannerUrl: true, thumbnailUrl: true },
    });
    await withBanner(form, before.bannerUrl, (bannerUrl) =>
      withBanner(
        form,
        before.thumbnailUrl,
        async (thumbnailUrl) => {
          await prisma.group.update({ where: { id: groupId }, data: { ...data, bannerUrl, thumbnailUrl } });
        },
        { field: "thumbnail" },
      ),
    );
  });
  if (result) return result;
  revalidatePath(`/admin/groups/${groupId}`);
  return { ok: "Saved." };
}

export async function deleteGroup(groupId: string): Promise<void> {
  await requireSuperUser();
  const banners = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    select: {
      bannerUrl: true,
      thumbnailUrl: true,
      series: { select: { bannerUrl: true, dates: { select: { bannerUrl: true } } } },
    },
  });
  await prisma.group.delete({ where: { id: groupId } });
  await dropBanners([banners.bannerUrl, banners.thumbnailUrl, ...banners.series.flatMap((s) => [s.bannerUrl, ...s.dates.map((d) => d.bannerUrl)])]);
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
    rounds: roundsFromForm(form),
    songLock: songLock(form),
    ...zelleFields(form),
  };
}

/** When song changes lock; anything unexpected falls back to the default, per round. */
function songLock(form: FormData): SongLock {
  const value = String(form.get("songLock")) as SongLock;
  return SONG_LOCKS.includes(value) ? value : "ROUND_START";
}

/** Where members send Zelle payments. Both are optional. */
function zelleFields(form: FormData) {
  return {
    zelleName: optionalText(form, "zelleName", { max: 100 }),
    zelleHandle: optionalText(form, "zelleHandle", { max: 100 }),
  };
}

/**
 * Refuses to drop rounds that upcoming dates already use: a song or a slot
 * in a round past the new count would vanish from the running order.
 */
async function checkRoundCount(dateIds: string[], count: number, fromSeries: boolean) {
  if (dateIds.length === 0) return;
  const where = { eventDateId: { in: dateIds }, round: { gt: count } };
  const [songs, slots] = await Promise.all([
    prisma.song.findMany({ where: { ...where, status: "ACTIVE" }, select: { round: true }, distinct: ["round"] }),
    prisma.roundSlot.findMany({ where, select: { round: true }, distinct: ["round"] }),
  ]);
  const used = [...new Set([...songs, ...slots].map((r) => r.round))].sort((a, b) => a - b);
  if (used.length) {
    const which = used.map((r) => `round ${r}`).join(" and ");
    throw new FormError(
      `Singers already have songs or slots in ${which}${fromSeries ? " on an upcoming date" : ""}, ` +
        `so keep at least ${used.at(-1)} rounds. Ask them to clear those songs first` +
        (fromSeries ? ", or set that date's own rounds in its settings." : "."),
    );
  }
}

/** Upcoming dates of a series that follow its rounds (no rounds of their own). */
async function datesFollowingSeriesRounds(seriesId: string) {
  const dates = await prisma.eventDate.findMany({
    where: { seriesId, status: "SCHEDULED", endsAt: { gte: new Date() }, NOT: { overrides: { has: "rounds" } } },
    select: { id: true },
  });
  return dates.map((d) => d.id);
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
    await withBanner(form, null, async (bannerUrl) => {
      const series = await prisma.eventSeries.create({
        data: {
          ...data,
          bannerUrl,
          groupId,
          privateToken: data.visibility === "PRIVATE" ? newPrivateToken() : null,
        },
      });
      id = series.id;
    });
    await syncSeriesDates(id);
  });
  if (result) return result;
  redirect(`/admin/events/${id}`);
}

export async function updateSeries(seriesId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const groupId = await seriesGroup(seriesId);
  await requireGroupAdmin(groupId);
  const result = await attempt(async () => {
    const data = seriesFields(form);
    const following = await datesFollowingSeriesRounds(seriesId);
    await checkRoundCount(following, data.rounds.length, true);
    const before = await prisma.eventSeries.findUniqueOrThrow({ where: { id: seriesId } });
    await withBanner(form, before.bannerUrl, async (bannerUrl) => {
      await prisma.eventSeries.update({
        where: { id: seriesId },
        data: {
          ...data,
          bannerUrl,
          privateToken: data.visibility === "PRIVATE" ? (before.privateToken ?? newPrivateToken()) : before.privateToken,
        },
      });
    });
    // Dates follow these settings unless they override them, so there's nothing to copy.
    await syncSeriesDates(seriesId);
    // A round that now goes by check-in or payment order gives slots to singers already here.
    for (const id of following) await settle(id);
  });
  if (result) return result;
  revalidatePath(`/admin/events/${seriesId}`);
  return { ok: "Saved. Dates that don't override a setting now use the new one." };
}

export async function deleteSeries(seriesId: string): Promise<void> {
  const groupId = await seriesGroup(seriesId);
  await requireGroupAdmin(groupId);
  const banners = await prisma.eventSeries.findUniqueOrThrow({
    where: { id: seriesId },
    select: { bannerUrl: true, dates: { select: { bannerUrl: true } } },
  });
  await prisma.eventSeries.delete({ where: { id: seriesId } });
  await dropBanners([banners.bannerUrl, ...banners.dates.map((d) => d.bannerUrl)]);
  redirect(`/admin/groups/${groupId}`);
}

export async function resetPrivateLink(seriesId: string): Promise<void> {
  const groupId = await seriesGroup(seriesId);
  await requireGroupAdmin(groupId);
  await prisma.eventSeries.update({ where: { id: seriesId }, data: { privateToken: newPrivateToken() } });
  revalidatePath(`/admin/events/${seriesId}`);
}

/** Deletes uploaded banners left unused after a group or event is deleted. */
async function dropBanners(urls: (string | null)[]) {
  for (const url of new Set(urls)) await dropReplacedBanner(url, null);
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
      status: true,
      bannerUrl: true,
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
    const rounds = own("rounds") ? roundsFromForm(form) : null;
    const series = await prisma.eventSeries.findUniqueOrThrow({ where: { id: d.seriesId }, select: { rounds: true } });
    await checkRoundCount([dateId], (rounds ?? parseRounds(series.rounds)).length, false);

    const settings = {
        startsAt,
        endsAt,
        originalStartsAt,
        overrides,
        description: own("description") ? optionalText(form, "description", { max: 2000 }) : null,
        singerPriceCents: own("pricing") ? price(form, "singerPrice", "Singer price") : null,
        listenerPriceCents: own("pricing") ? price(form, "listenerPrice", "Listener price") : null,
        maxSingers: own("capacity") ? optionalCap(form, "maxSingers", "Singer cap") : null,
        maxListeners: own("capacity") ? optionalCap(form, "maxListeners", "Listener cap") : null,
        rounds: rounds ?? Prisma.DbNull,
        ...(own("zelle") ? zelleFields(form) : { zelleName: null, zelleHandle: null }),
        songLock: own("songLock") ? songLock(form) : null,
    };
    await withBanner(
      form,
      d.bannerUrl,
      async (bannerUrl) => {
        if (own("banner") && !bannerUrl) {
          throw new FormError("Upload a banner image or paste a link, or untick \"Change for this date\" for the banner.");
        }
        await prisma.eventDate.update({ where: { id: dateId }, data: { ...settings, bannerUrl } });
      },
      { use: own("banner") },
    );
    if (d.status === "SCHEDULED") await settle(dateId);
  }, "This event already has a date starting at that time.");
  if (result) return result;
  revalidatePath(`/admin/dates/${dateId}`);
  revalidatePath(`/admin/dates/${dateId}/settings`);
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

/** Archives a past date (hidden from the group page's past karaoke nights), or brings it back. */
export async function setDateArchived(dateId: string, archived: boolean): Promise<void> {
  const d = await dateGroup(dateId);
  await requireGroupAdmin(d.series.groupId);
  await prisma.eventDate.update({ where: { id: dateId }, data: { archivedAt: archived ? new Date() : null } });
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
