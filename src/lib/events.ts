import type { SignUpStatus } from "@prisma/client";

// Sign-up statuses that hold a spot under the cap (spec: "Holding a spot under the cap").
export const HOLDS_SPOT: SignUpStatus[] = ["RESERVED", "UNDER_REVIEW", "CONFIRMED", "REJECTED"];

/** "3 of 20" with a cap, or just "3" without one. */
export function spotsLabel(taken: number, cap: number | null): string {
  return cap == null ? String(taken) : `${taken} of ${cap}`;
}

/** Map link for a venue address. */
export function mapUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
