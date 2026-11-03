import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { EventDate } from "@prisma/client";
import { HOLDS_SPOT } from "@/lib/events";

// In-person check-in. A group admin opens check-in for a date (from an hour
// before it starts) and puts the check-in screen up at the venue. That screen
// shows a QR code holding a short-lived signed code that changes every
// CODE_WINDOW_MS. A guest scans it with their phone, signs in, and is checked
// in at the server's time. A photo of the code sent to someone at home stops
// working within a minute, and closing or reopening check-in voids every
// earlier code, because each opening gets a fresh secret.
//
// Flow: QR -> /checkin/<dateId>/scan?t=<code> (route handler) checks the code
// and leaves a short-lived, single-use "pass" cookie, then sends the guest to
// /checkin/<dateId>, which signs them in if needed and checks them in.

/** How early an admin can open check-in, before the date's start. */
export const OPENS_BEFORE_MS = 60 * 60 * 1000;
/** Each QR code is shown for this long; it is accepted for up to twice as long. */
export const CODE_WINDOW_MS = 30 * 1000;
/** How long a scan stays good while the guest signs in. */
export const PASS_MS = 10 * 60 * 1000;
export const PASS_COOKIE = "checkin-pass";

/** Who can check in: anyone holding a spot (paid, or still paying; admins see which). */
export const CAN_CHECK_IN = HOLDS_SPOT;

type CheckInDate = Pick<EventDate, "status" | "startsAt" | "endsAt" | "checkInOpenedAt" | "checkInSecret">;

/** When an admin may open check-in for this date. */
export function checkInOpensAt(date: Pick<EventDate, "startsAt">): Date {
  return new Date(date.startsAt.getTime() - OPENS_BEFORE_MS);
}

/** True when an admin may open check-in now: from an hour before the start until the end. */
export function canOpenCheckIn(date: Pick<EventDate, "status" | "startsAt" | "endsAt">, now = new Date()): boolean {
  return date.status === "SCHEDULED" && now >= checkInOpensAt(date) && now < date.endsAt;
}

/** True while guests can check in: an admin opened it and the event hasn't ended. */
export function checkInIsOpen(date: CheckInDate, now = new Date()): boolean {
  return date.status === "SCHEDULED" && !!date.checkInOpenedAt && !!date.checkInSecret && now < date.endsAt;
}

export function newCheckInSecret(): string {
  return randomBytes(24).toString("base64url");
}

function serverKey(): string {
  const key = process.env.AUTH_SECRET;
  if (!key) throw new Error("AUTH_SECRET is not set");
  return key;
}

function sign(...parts: (string | number)[]): string {
  return createHmac("sha256", serverKey()).update(parts.join(".")).digest("base64url").slice(0, 22);
}

function sameText(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The code shown on the venue screen right now, and when it is replaced. */
export function currentCode(dateId: string, secret: string, now = Date.now()) {
  const window = Math.floor(now / CODE_WINDOW_MS);
  return { code: `${window}.${sign("qr", dateId, secret, window)}`, nextAt: (window + 1) * CODE_WINDOW_MS };
}

/** True for the code on screen now or the one just before it (so a scan at the switch still works). */
export function codeIsValid(dateId: string, secret: string, code: string, now = Date.now()): boolean {
  const m = /^(\d+)\.([\w-]{22})$/.exec(code);
  if (!m) return false;
  const window = Number(m[1]);
  const current = Math.floor(now / CODE_WINDOW_MS);
  if (window !== current && window !== current - 1) return false;
  return sameText(m[2], sign("qr", dateId, secret, window));
}

/** Cookie value proving this browser scanned a valid code for the date. */
export function makePass(dateId: string, secret: string, now = Date.now()): string {
  return `${dateId}.${now}.${sign("pass", dateId, secret, now)}`;
}

export function passIsValid(dateId: string, secret: string, pass: string | undefined, now = Date.now()): boolean {
  if (!pass) return false;
  const [id, at, sig] = pass.split(".");
  const issued = Number(at);
  if (id !== dateId || !Number.isFinite(issued) || !sig) return false;
  if (issued > now + 5000 || now - issued > PASS_MS) return false;
  return sameText(sig, sign("pass", dateId, secret, issued));
}

/** Path the QR code points at (prefix with the site's origin). */
export function scanPath(dateId: string, code: string): string {
  return `/checkin/${dateId}/scan?t=${encodeURIComponent(code)}`;
}
