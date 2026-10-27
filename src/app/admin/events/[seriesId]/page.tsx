import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/app/admin/Breadcrumbs";
import { deleteSeries, resetPrivateLink, updateSeries } from "@/app/admin/actions";
import ConfirmButton from "@/components/admin/ConfirmButton";
import CopyLink from "@/components/admin/CopyLink";
import SeriesForm from "@/components/admin/SeriesForm";
import { cardClass } from "@/components/ui";
import { HOLDS_SPOT, settingsFor, spotsLabel } from "@/lib/events";
import { formatClock, formatEventDate, formatEventTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireGroupAdmin } from "@/lib/roles";
import { describeSchedule, ruleOf, syncSeriesDates } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function SeriesAdminPage({ params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = await params;
  const found = await prisma.eventSeries.findUnique({ where: { id: seriesId }, select: { groupId: true } });
  if (!found) notFound();
  await requireGroupAdmin(found.groupId, `/admin/events/${seriesId}`);
  await syncSeriesDates(seriesId);

  const series = await prisma.eventSeries.findUniqueOrThrow({
    where: { id: seriesId },
    include: {
      group: true,
      dates: {
        where: { startsAt: { gte: new Date() }, status: { not: "DELETED" } },
        orderBy: { startsAt: "asc" },
        include: { signUps: { where: { status: { in: HOLDS_SPOT } }, select: { role: true } } },
      },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <Breadcrumbs
          items={[
            { href: "/admin", label: "Admin" },
            { href: `/admin/groups/${series.groupId}`, label: series.group.name },
            { label: series.title },
          ]}
        />
        <h1 className="font-display text-3xl text-royal">{series.title}</h1>
        <p className="text-ink-muted">
          {describeSchedule(ruleOf(series))}, {formatClock(series.startTime)} – {formatClock(series.endTime)} ·{" "}
          {series.venueName} · {series.visibility === "PRIVATE" ? "Private" : "Public"}
        </p>
      </div>

      {series.visibility === "PRIVATE" && series.privateToken && (
        <section className={cardClass}>
          <h2 className="mb-1 text-xl font-semibold">Private link</h2>
          <p className="mb-3 text-sm text-ink-muted">
            This event isn&apos;t on the home page. Share this link with the people you want to invite.
          </p>
          <CopyLink path={`/e/p/${series.privateToken}`} />
          <div className="mt-3">
            <ConfirmButton
              action={resetPrivateLink.bind(null, series.id)}
              label="Reset link"
              danger={false}
              confirm="Make a new link? The old link will stop working."
            />
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xl font-semibold">Upcoming dates</h2>
        {series.dates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-ink-muted">
            No upcoming dates. Check the schedule below.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-white">
            {series.dates.map((d) => {
              const singers = d.signUps.filter((s) => s.role === "SINGER").length;
              const listeners = d.signUps.length - singers;
              const settings = settingsFor(d, series);
              return (
                <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {formatEventDate(d.startsAt)}
                      {settings.theme && <span className="text-lapis"> · {settings.theme}</span>}
                      {d.signupsOpen && d.status === "SCHEDULED" && (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Sign-ups open</span>
                      )}
                      {d.overrides.length > 0 && (
                        <span className="ml-2 rounded-full bg-mist px-2 py-0.5 text-xs font-medium text-ink-muted">Custom settings</span>
                      )}
                      {d.originalStartsAt && (
                        <span className="ml-2 rounded-full bg-mist px-2 py-0.5 text-xs font-medium text-ink-muted">Rescheduled</span>
                      )}
                      {d.status === "CANCELLED" && (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Cancelled</span>
                      )}
                    </p>
                    <p className="text-sm text-ink-muted">
                      {formatEventTime(d.startsAt, d.endsAt)} · Singers {spotsLabel(singers, settings.maxSingers)} · Listeners{" "}
                      {spotsLabel(listeners, settings.maxListeners)}
                    </p>
                  </div>
                  <div className="flex gap-3 text-sm font-medium">
                    <Link
                      href={`/e/${d.id}${series.privateToken && series.visibility === "PRIVATE" ? `?k=${series.privateToken}` : ""}`}
                      className="text-cobalt hover:underline"
                    >
                      View
                    </Link>
                    <Link href={`/admin/dates/${d.id}`} className="text-cobalt hover:underline">
                      Edit
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="mb-1 text-xl font-semibold">Event settings</h2>
        <p className="mb-4 text-sm text-ink-muted">
          These are the template for every date. A date uses them unless you change a setting for that date; people
          who already registered keep the price they signed up at.
        </p>
        <SeriesForm action={updateSeries.bind(null, series.id)} series={series} />
      </section>

      <section className="rounded-xl border border-red-200 bg-white p-4 sm:p-6">
        <h2 className="mb-1 text-xl font-semibold">Delete event</h2>
        <p className="mb-4 text-sm text-ink-muted">
          Deletes this event with all its dates and sign-ups. To skip one night, cancel that date instead.
        </p>
        <ConfirmButton
          action={deleteSeries.bind(null, series.id)}
          label="Delete event"
          confirm={`Delete "${series.title}" with all its dates and sign-ups? This can't be undone.`}
        />
      </section>

    </div>
  );
}
