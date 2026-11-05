import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/app/admin/Breadcrumbs";
import { cardClass } from "@/components/ui";
import { RATING_LABEL, feedbackOpen } from "@/lib/feedback";
import { formatDateTime, formatEventDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireGroupAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Feedback · Karaoke Adda", robots: { index: false } };

// Feedback responses for one date (src/lib/feedback.ts), for that group's admins and super users.
export default async function DateFeedbackPage({ params }: { params: Promise<{ dateId: string }> }) {
  const { dateId } = await params;
  const date = await prisma.eventDate.findUnique({
    where: { id: dateId },
    include: { series: { include: { group: { select: { name: true } } } } },
  });
  if (!date || date.status === "DELETED") notFound();
  await requireGroupAdmin(date.series.groupId, `/admin/dates/${dateId}/feedback`);
  const responses = await prisma.eventFeedback.findMany({
    where: { eventDateId: dateId },
    orderBy: { updatedAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });
  // Show the name they used on their sign-up for this date, when they had one.
  const signUps = await prisma.signUp.findMany({
    where: { eventDateId: dateId, userId: { in: responses.map((r) => r.userId) } },
    select: { userId: true, displayName: true, role: true },
  });
  const count = responses.length;
  const average = count ? responses.reduce((sum, r) => sum + r.rating, 0) / count : null;
  const tally = [5, 4, 3, 2, 1].map((stars) => ({ stars, n: responses.filter((r) => r.rating === stars).length }));
  const { series } = date;

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs
          items={[
            { href: "/admin", label: "Admin" },
            { href: `/admin/groups/${series.groupId}`, label: series.group.name },
            { href: `/admin/events/${series.id}`, label: series.title },
            { href: `/admin/dates/${dateId}`, label: formatEventDate(date.startsAt) },
            { label: "Feedback" },
          ]}
        />
        <h1 className="font-display text-3xl text-royal">Feedback</h1>
        <p className="text-ink-muted">
          {series.title} · {formatEventDate(date.startsAt)} · {series.venueName}
        </p>
      </div>

      {count === 0 ? (
        <p className={`${cardClass} text-ink-muted`}>
          {feedbackOpen(date)
            ? "No feedback yet. Signed-in people see a link to the form on the event page."
            : "Feedback opens on the event page once this date is over."}
        </p>
      ) : (
        <>
          <section className={`${cardClass} flex flex-wrap items-center gap-6`}>
            <div>
              <p className="text-4xl font-semibold text-royal">{average!.toFixed(1)} ★</p>
              <p className="text-sm text-ink-muted">from {count} {count === 1 ? "response" : "responses"}</p>
            </div>
            <ul className="min-w-48 flex-1 space-y-1 text-sm">
              {tally.map(({ stars, n }) => (
                <li key={stars} className="flex items-center gap-2">
                  <span className="w-10 shrink-0">{stars} ★</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-mist">
                    <span className="block h-full bg-gold" style={{ width: `${(n / count) * 100}%` }} />
                  </span>
                  <span className="w-6 shrink-0 text-right text-ink-muted">{n}</span>
                </li>
              ))}
            </ul>
          </section>

          <ul className="space-y-3">
            {responses.map((r) => {
              const s = signUps.find((x) => x.userId === r.userId);
              return (
                <li key={r.id} className={cardClass}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">
                      {s?.displayName ?? r.user.name ?? r.user.email ?? "Someone"}
                      <span className="ml-2 text-sm font-normal text-ink-muted">
                        {s ? (s.role === "SINGER" ? "Singer" : "Listener") : "Didn't sign up"}
                        {r.user.email && ` · ${r.user.email}`}
                      </span>
                    </p>
                    <p className="text-sm text-ink-muted">{formatDateTime(r.updatedAt)}</p>
                  </div>
                  <p className="mt-1">
                    <span className="text-gold" aria-hidden>
                      {"★".repeat(r.rating)}
                    </span>
                    <span className="text-ink-muted/30" aria-hidden>
                      {"★".repeat(5 - r.rating)}
                    </span>
                    <span className="ml-2 text-sm text-ink-muted">
                      {r.rating} of 5 · {RATING_LABEL[r.rating]}
                    </span>
                  </p>
                  {r.comment && <p className="mt-2 whitespace-pre-line">{r.comment}</p>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
