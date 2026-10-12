import { prisma } from "@/lib/prisma";
import { formatEventDate, formatEventTime, formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

// Public dashboard: upcoming public event dates, soonest first.
export default async function Home() {
  const dates = await prisma.eventDate.findMany({
    where: {
      status: "SCHEDULED",
      startsAt: { gte: new Date() },
      series: { visibility: "PUBLIC" },
    },
    orderBy: { startsAt: "asc" },
    take: 50,
    include: { series: { include: { group: true } } },
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold sm:text-3xl">Upcoming karaoke nights</h1>
      <p className="mb-6 text-gray-600">Public events from Bay Area Desi karaoke groups.</p>

      {dates.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
          No upcoming events yet. Check back soon.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dates.map((d) => {
            const banner = d.bannerUrl ?? d.series.bannerUrl ?? d.series.group.bannerUrl;
            return (
              <li key={d.id} className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
                {banner ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={banner} alt="" className="h-32 w-full object-cover" />
                ) : (
                  <div className="h-32 w-full bg-gradient-to-br from-rose-500 to-amber-400" />
                )}
                <div className="space-y-1 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-rose-700">
                    {d.series.group.name}
                  </p>
                  <h2 className="text-lg font-semibold leading-snug">{d.series.title}</h2>
                  <p className="text-sm text-gray-700">
                    {formatEventDate(d.startsAt)} · {formatEventTime(d.startsAt, d.endsAt)}
                  </p>
                  <p className="text-sm text-gray-600">{d.series.venueName}</p>
                  <p className="text-sm">
                    <span className="font-medium">Theme:</span> {d.theme}
                  </p>
                  <p className="text-sm text-gray-700">
                    Singer {formatPrice(d.singerPriceCents)} · Listener {formatPrice(d.listenerPriceCents)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
