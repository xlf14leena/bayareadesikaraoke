import Link from "next/link";
import { primaryButton, secondaryButton } from "@/components/ui";
import { feedbackOpen, feedbackPath, feedbackSummary, summaryLabel } from "@/lib/feedback";
import { prisma } from "@/lib/prisma";
import type { Viewer } from "@/lib/roles";

/**
 * On the event page once a date has ended: a link to the feedback form for
 * signed-in people, and for the group's admins a link to the responses.
 */
export default async function FeedbackPrompt({
  date,
  viewer,
  isAdmin,
  privateKey,
}: {
  date: { id: string; status: string; endsAt: Date };
  viewer: Viewer | null;
  isAdmin: boolean;
  privateKey: string | null;
}) {
  if (!viewer || !feedbackOpen(date)) return null;
  const [mine, summary] = await Promise.all([
    prisma.eventFeedback.findUnique({
      where: { eventDateId_userId: { eventDateId: date.id, userId: viewer.id } },
      select: { rating: true },
    }),
    isAdmin ? feedbackSummary(date.id) : null,
  ]);
  const href = feedbackPath(date.id, privateKey);

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/60 bg-gold/10 p-4 sm:p-6">
      <div>
        <h2 className="text-xl font-semibold">{mine ? "Thanks for your feedback" : "How was the night?"}</h2>
        <p className="text-sm text-ink-muted">
          {mine
            ? `You rated it ${mine.rating} of 5 stars. You can still change your answer.`
            : "This event is over. Tell the organizers what you thought: it takes a minute."}
        </p>
        {isAdmin && (
          <p className="mt-1 text-sm">
            <Link href={`/admin/dates/${date.id}/feedback`} className="font-medium text-cobalt hover:underline">
              {summaryLabel(summary?.count ?? 0, summary?.average ?? null) ?? "No feedback yet"} · see responses →
            </Link>
          </p>
        )}
      </div>
      <Link href={href} className={mine ? secondaryButton : primaryButton}>
        {mine ? "Edit feedback" : "Give feedback"}
      </Link>
    </section>
  );
}
