import { notFound } from "next/navigation";
import EventDateList from "@/components/EventDateList";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Group page: the group's banner, description and upcoming public dates.
export default async function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const group = await prisma.group.findUnique({ where: { slug } });
  if (!group) notFound();
  const dates = await prisma.eventDate.findMany({
    where: {
      status: "SCHEDULED",
      endsAt: { gte: new Date() },
      series: { groupId: group.id, visibility: "PUBLIC" },
    },
    orderBy: { startsAt: "asc" },
    take: 50,
    include: { series: { include: { group: true } } },
  });

  return (
    <div className="space-y-6">
      {group.bannerUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={group.bannerUrl} alt="" className="h-44 w-full rounded-2xl object-cover sm:h-64" />
      )}
      <header>
        <h1 className="font-display text-3xl text-royal sm:text-4xl">{group.name}</h1>
        {group.description && <p className="mt-1 whitespace-pre-line text-ink-muted">{group.description}</p>}
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
    </div>
  );
}
