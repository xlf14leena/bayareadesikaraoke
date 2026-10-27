import type { EventSeries, Frequency } from "@prisma/client";
import { TIME_ZONE } from "@/lib/format";
import { prisma } from "@/lib/prisma";

// Dates are generated this far ahead (spec: "Events and recurrence").
export const GENERATE_WEEKS_AHEAD = 8;

// ---------- Calendar dates as "YYYY-MM-DD" strings ----------

export function ymdOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(ymd: string, days: number): string {
  const d = parseYmd(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return ymdOf(d);
}

/** Today's date in Pacific time. */
export function todayPacific(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

// ---------- Pacific wall time to UTC ----------

function offsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** The instant a Pacific date and "HH:MM" time happen. */
export function pacificToUtc(ymd: string, hm: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const [h, mi] = hm.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, h, mi);
  const first = wall - offsetMinutes(new Date(wall)) * 60000;
  const second = wall - offsetMinutes(new Date(first)) * 60000;
  return new Date(second);
}

/** "HH:MM" Pacific time of an instant, for form defaults. */
export function pacificTimeOf(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

/** "YYYY-MM-DD" Pacific date of an instant. */
export function pacificDateOf(d: Date): string {
  return todayPacific(d);
}

// ---------- Schedule rule ----------

export type ScheduleRule = {
  frequency: Frequency;
  firstDate: string; // YYYY-MM-DD
  endDate: string | null;
  monthlyWeekOfMonth: number | null; // 1-4, or -1 for last; null = from firstDate
  startTime: string; // HH:MM
  endTime: string; // HH:MM
};

export function ruleOf(series: EventSeries): ScheduleRule {
  return {
    frequency: series.frequency,
    firstDate: ymdOf(series.firstDate),
    endDate: series.endDate ? ymdOf(series.endDate) : null,
    monthlyWeekOfMonth: series.monthlyWeekOfMonth,
    startTime: series.startTime,
    endTime: series.endTime,
  };
}

/** Week of the month the date falls in: 1 for days 1-7, 2 for 8-14 and so on. */
export function weekOfMonth(ymd: string): number {
  return Math.ceil(parseYmd(ymd).getUTCDate() / 7);
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): string | null {
  if (n === -1) {
    const last = new Date(Date.UTC(year, month + 1, 0));
    last.setUTCDate(last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7));
    return ymdOf(last);
  }
  const first = new Date(Date.UTC(year, month, 1));
  const day = 1 + ((weekday - first.getUTCDay() + 7) % 7) + 7 * (n - 1);
  const d = new Date(Date.UTC(year, month, day));
  return d.getUTCMonth() === month ? ymdOf(d) : null;
}

/** Calendar dates the rule produces between from and to (inclusive). */
export function occurrences(rule: ScheduleRule, from: string, to: string): string[] {
  const out: string[] = [];
  const last = rule.endDate && rule.endDate < to ? rule.endDate : to;
  const keep = (ymd: string) => ymd >= from && ymd >= rule.firstDate && ymd <= last;

  if (rule.frequency === "ONCE") {
    // A one-time event is created however far ahead it is.
    return rule.firstDate >= from ? [rule.firstDate] : [];
  }

  if (rule.frequency === "WEEKLY" || rule.frequency === "BIWEEKLY") {
    const step = rule.frequency === "WEEKLY" ? 7 : 14;
    for (let d = rule.firstDate; d <= last; d = addDays(d, step)) {
      if (keep(d)) out.push(d);
    }
    return out;
  }

  // MONTHLY: same weekday as the first date, in the chosen week of each month.
  const first = parseYmd(rule.firstDate);
  const weekday = first.getUTCDay();
  const n = rule.monthlyWeekOfMonth ?? weekOfMonth(rule.firstDate);
  for (let y = first.getUTCFullYear(), m = first.getUTCMonth(); ; m++) {
    if (m > 11) {
      y++;
      m = 0;
    }
    const monthStart = ymdOf(new Date(Date.UTC(y, m, 1)));
    if (monthStart > last) break;
    const d = nthWeekdayOfMonth(y, m, weekday, n);
    if (d && keep(d)) out.push(d);
  }
  return out;
}

/** Start and end instants for one calendar date. An end time before the start runs past midnight. */
export function timesFor(rule: Pick<ScheduleRule, "startTime" | "endTime">, ymd: string) {
  const startsAt = pacificToUtc(ymd, rule.startTime);
  const endDay = rule.endTime <= rule.startTime ? addDays(ymd, 1) : ymd;
  return { startsAt, endsAt: pacificToUtc(endDay, rule.endTime) };
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDINALS: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", [-1]: "last" };

/** Plain-language schedule, e.g. "Every Saturday" or "2nd Saturday of each month". */
export function describeSchedule(rule: ScheduleRule): string {
  const weekday = WEEKDAYS[parseYmd(rule.firstDate).getUTCDay()];
  switch (rule.frequency) {
    case "ONCE":
      return "One time";
    case "WEEKLY":
      return `Every ${weekday}`;
    case "BIWEEKLY":
      return `Every other ${weekday}`;
    case "MONTHLY":
      const nth = ORDINALS[rule.monthlyWeekOfMonth ?? weekOfMonth(rule.firstDate)];
      return `${nth[0].toUpperCase()}${nth.slice(1)} ${weekday} of each month`;
  }
}

// ---------- Keeping EventDates in step with the series ----------

/**
 * Creates the series' missing future dates (8 weeks ahead) and removes future
 * dates the schedule no longer produces, unless someone has signed up for
 * them. Dates without sign-ups also pick up a changed end time.
 *
 * Admin changes to single dates are kept: a moved date is matched to the
 * schedule slot it came from (originalStartsAt) and never removed, and a
 * deleted date stays as a DELETED row so its slot isn't created again.
 */
export async function syncSeriesDates(seriesId: string, now = new Date()): Promise<void> {
  const series = await prisma.eventSeries.findUnique({ where: { id: seriesId } });
  if (!series) return;
  const rule = ruleOf(series);
  const today = todayPacific(now);
  const wanted = new Map<number, { startsAt: Date; endsAt: Date }>();
  for (const ymd of occurrences(rule, today, addDays(today, GENERATE_WEEKS_AHEAD * 7))) {
    const t = timesFor(rule, ymd);
    if (t.startsAt > now) wanted.set(t.startsAt.getTime(), t);
  }

  const existing = await prisma.eventDate.findMany({
    where: { seriesId, OR: [{ startsAt: { gt: now } }, { originalStartsAt: { gt: now } }] },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      originalStartsAt: true,
      status: true,
      _count: { select: { signUps: true } },
    },
  });

  const stale: string[] = [];
  for (const d of existing) {
    const slot = (d.originalStartsAt ?? d.startsAt).getTime();
    const want = wanted.get(slot);
    if (want) {
      wanted.delete(slot);
      const untouched = !d.originalStartsAt && d.status !== "DELETED" && d._count.signUps === 0;
      if (untouched && want.endsAt.getTime() !== d.endsAt.getTime()) {
        await prisma.eventDate.update({ where: { id: d.id }, data: { endsAt: want.endsAt } });
      }
    } else if (!d.originalStartsAt && d._count.signUps === 0) {
      stale.push(d.id);
    }
  }
  if (stale.length) await prisma.eventDate.deleteMany({ where: { id: { in: stale } } });

  if (wanted.size) {
    await prisma.eventDate.createMany({
      // New dates follow the series' settings until an admin overrides them,
      // and stay closed until an admin opens sign-ups.
      data: [...wanted.values()].map((t) => ({ seriesId, startsAt: t.startsAt, endsAt: t.endsAt })),
      skipDuplicates: true,
    });
  }
}

/** Tops up dates for every recurring series (used by the daily cron and admin pages). */
export async function syncAllSeries(where: { groupId?: string } = {}): Promise<void> {
  const series = await prisma.eventSeries.findMany({
    where: { ...where, frequency: { not: "ONCE" } },
    select: { id: true },
  });
  for (const s of series) await syncSeriesDates(s.id);
}
