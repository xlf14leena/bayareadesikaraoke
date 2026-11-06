export const TIME_ZONE = "America/Los_Angeles";

export function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function formatEventDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatEventTime(start: Date, end: Date): string {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${f.format(start)} – ${f.format(end)}`;
}

// Month and day for the calendar badge, e.g. { month: "Oct", day: "17" }.
export function formatDateBadge(d: Date): { month: string; day: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    month: "short",
    day: "numeric",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { month: get("month"), day: get("day") };
}

// "19:00" -> "7:00 PM".
export function formatClock(hm: string): string {
  const [h, m] = hm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

// "Tue, Nov 3, 7:05 PM" in Pacific time.
export function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

/** "4:12", or "1:02:05" for an hour or more. */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** "1 hr 5 min" or "42 min", for totals. */
export function formatTotal(seconds: number): string {
  const mins = Math.round(seconds / 60);
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h} hr ${mins % 60} min` : `${mins} min`;
}

/** Tracks longer than this (6 minutes) are shown in red, so organizers and singers notice them. */
export const LONG_TRACK_SECONDS = 6 * 60;
