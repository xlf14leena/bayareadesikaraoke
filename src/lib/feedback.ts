import { prisma } from "@/lib/prisma";
import { canAdminGroup, type Viewer } from "@/lib/roles";

// Post-event feedback. Once a date has ended, every signed-in person who can
// see its event page gets a link to a short form: a 1 to 5 star rating and an
// optional comment. One response per person per date (sending again updates
// it). The group's admins and super users read the responses at
// /admin/dates/<id>/feedback.

export const MAX_COMMENT = 2000;

export const RATING_LABEL: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Great",
  5: "Amazing",
};

/** Feedback opens when a date that went ahead has ended. */
export function feedbackOpen(date: { status: string; endsAt: Date }, now = new Date()): boolean {
  return date.status === "SCHEDULED" && date.endsAt <= now;
}

/**
 * Whether this signed-in person may see the event, and so give feedback on it:
 * anyone for a public event; for a private one, its admins, people who signed
 * up, or someone holding the private link's key.
 */
export async function canSeeEvent(
  viewer: Viewer,
  date: { id: string; series: { groupId: string; visibility: string; privateToken: string | null } },
  key: string | null | undefined,
): Promise<boolean> {
  const { series } = date;
  if (series.visibility !== "PRIVATE" || canAdminGroup(viewer, series.groupId)) return true;
  if (key && key === series.privateToken) return true;
  return (await prisma.signUp.count({ where: { eventDateId: date.id, userId: viewer.id } })) > 0;
}

/** Path of a date's feedback form. Pass the private key (`k`) for private events. */
export function feedbackPath(dateId: string, key?: string | null): string {
  return key ? `/feedback/${dateId}?k=${encodeURIComponent(key)}` : `/feedback/${dateId}`;
}

/** "4.3 ★ from 12 responses", or null with none. */
export function summaryLabel(count: number, average: number | null): string | null {
  if (count === 0 || average == null) return null;
  return `${average.toFixed(1)} ★ from ${count} ${count === 1 ? "response" : "responses"}`;
}

export async function feedbackSummary(dateId: string) {
  const agg = await prisma.eventFeedback.aggregate({
    where: { eventDateId: dateId },
    _count: true,
    _avg: { rating: true },
  });
  return { count: agg._count, average: agg._avg.rating };
}
