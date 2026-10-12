import { notFound, redirect } from "next/navigation";
import EventDateList from "@/components/EventDateList";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Private link for a series. One upcoming date opens straight away; several are listed.
export default async function PrivateEventPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const series = await prisma.eventSeries.findUnique({
    where: { privateToken: token },
    include: {
      group: true,
      dates: { where: { status: "SCHEDULED", endsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" } },
    },
  });
  if (!series || series.visibility !== "PRIVATE") notFound();

  const query = `?k=${encodeURIComponent(token)}`;
  if (series.dates.length === 1) redirect(`/e/${series.dates[0].id}${query}`);

  const { dates, ...rest } = series;
  return (
    <div>
      <p className="text-sm font-medium text-ink-muted">{series.group.name} · Private event</p>
      <h1 className="mb-4 font-display text-3xl text-royal">{series.title}</h1>
      {dates.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-ink-muted">
          No upcoming dates right now.
        </p>
      ) : (
        <EventDateList dates={dates.map((d) => ({ ...d, series: rest }))} query={query} />
      )}
    </div>
  );
}
