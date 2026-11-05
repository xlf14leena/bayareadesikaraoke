import Link from "next/link";
import { notFound } from "next/navigation";
import Banner from "@/components/Banner";
import Breadcrumbs from "@/components/Breadcrumbs";
import EventDateList from "@/components/EventDateList";
import GroupLinks from "@/components/GroupLinks";
import { bannerFor } from "@/lib/banner";
import { formatEventDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { canAdminGroup, getViewer } from "@/lib/roles";

export const dynamic = "force-dynamic";

// Group page: the group's banner, description, upcoming public dates and
// past ones (newest first) that an admin hasn't archived.
export default async function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [group, viewer] = await Promise.all([prisma.group.findUnique({ where: { slug } }), getViewer()]);
  if (!group) notFound();
  const isAdmin = canAdminGroup(viewer, group.id);
  const now = new Date();
  const publicDates = { status: "SCHEDULED", series: { groupId: group.id, visibility: "PUBLIC" } } as const;
  const include = { series: { include: { group: true } } } as const;
  const [dates, pastDates, archived] = await Promise.all([
    prisma.eventDate.findMany({
      where: { ...publicDates, endsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 50,
      include,
    }),
    prisma.eventDate.findMany({
      where: { ...publicDates, endsAt: { lt: now }, archivedAt: null },
      orderBy: { startsAt: "desc" },
      take: 50,
      include,
    }),
    isAdmin
      ? prisma.eventDate.findMany({
          where: { ...publicDates, endsAt: { lt: now }, archivedAt: { not: null } },
          orderBy: { startsAt: "desc" },
          take: 50,
          include: { series: true },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <Banner {...bannerFor(group.bannerUrl)} />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: group.name }]} />
      {/* Name on the left and the website / Facebook / Instagram icons on the right, across the
          same width as the event cards below. */}
      <header className="!mt-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h1 className="font-display text-3xl text-royal sm:text-4xl">{group.name}</h1>
          <GroupLinks group={group} className="shrink-0" />
        </div>
        {group.description && <p className="mt-2 whitespace-pre-line text-ink-muted">{group.description}</p>}
      </header>
      <section>
        <h2 className="mb-4 text-xl font-semibold">Upcoming karaoke nights</h2>
        {dates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-ink-muted">
            No upcoming public events.
          </p>
        ) : (
          <EventDateList dates={dates} />
        )}
      </section>
      {(pastDates.length > 0 || archived.length > 0) && (
        <section className="!mt-10">
          <h2 className="mb-4 text-xl font-semibold">Past karaoke nights</h2>
          {pastDates.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-ink-muted">
              No past events to show.
            </p>
          ) : (
            <EventDateList dates={pastDates} past />
          )}
          {archived.length > 0 && (
            <details className="mt-4 rounded-xl border border-line bg-white p-4">
              <summary className="cursor-pointer text-sm font-medium text-ink-muted">
                Archived ({archived.length}) · only admins see these
              </summary>
              <ul className="mt-3 divide-y divide-line text-sm">
                {archived.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      {d.series.title} · {formatEventDate(d.startsAt)}
                    </span>
                    <Link href={`/admin/dates/${d.id}#archive`} className="font-medium text-cobalt hover:underline">
                      Unarchive →
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
    </div>
  );
}
