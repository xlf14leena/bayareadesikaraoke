import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FeedbackForm from "@/components/feedback/FeedbackForm";
import { cardClass } from "@/components/ui";
import { eventPath } from "@/lib/event-url";
import { MAX_COMMENT, canSeeEvent, feedbackOpen, feedbackPath } from "@/lib/feedback";
import { formatEventDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireViewer } from "@/lib/roles";
import { sendFeedback } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Feedback · Bay Area Desi Karaoke", robots: { index: false } };

type Props = { params: Promise<{ dateId: string }>; searchParams: Promise<{ k?: string }> };

// The post-event feedback form (src/lib/feedback.ts), linked from the event page once the date has ended.
export default async function FeedbackPage({ params, searchParams }: Props) {
  const { dateId } = await params;
  const { k } = await searchParams;
  const viewer = await requireViewer(feedbackPath(dateId, k));
  const date = await prisma.eventDate.findUnique({
    where: { id: dateId },
    include: { series: { include: { group: { select: { slug: true, name: true } } } } },
  });
  if (!date || date.status === "DELETED" || !(await canSeeEvent(viewer, date, k))) notFound();
  const mine = await prisma.eventFeedback.findUnique({
    where: { eventDateId_userId: { eventDateId: dateId, userId: viewer.id } },
  });
  const open = feedbackOpen(date);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <p className="text-sm font-medium text-ink-muted">{date.series.group.name}</p>
        <h1 className="font-display text-3xl leading-tight text-royal">How was {date.series.title}?</h1>
        <p className="text-ink-muted">
          {formatEventDate(date.startsAt)} · {date.series.venueName}
        </p>
      </div>
      <section className={cardClass}>
        {date.status === "CANCELLED" ? (
          <p className="text-ink-muted">This date was cancelled, so there&apos;s nothing to give feedback on.</p>
        ) : !open ? (
          <p className="text-ink-muted">Feedback opens once the event is over. Come back after the show!</p>
        ) : (
          <>
            {mine && (
              <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                You sent feedback for this event. You can change it below.
              </p>
            )}
            <FeedbackForm
              action={sendFeedback.bind(null, dateId, k ?? null)}
              rating={mine?.rating ?? null}
              comment={mine?.comment ?? ""}
              maxComment={MAX_COMMENT}
            />
          </>
        )}
      </section>
      <Link href={eventPath(date, k)} className="inline-block text-sm font-medium text-cobalt hover:underline">
        ← Back to the event
      </Link>
    </div>
  );
}
