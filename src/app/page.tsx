import { prisma } from "@/lib/prisma";
import EventDateList from "@/components/EventDateList";

export const dynamic = "force-dynamic";

// Hero photo: "Group of 5 people singing together inside of a karaoke room" by Singa Karaoke,
// free to use under the Unsplash License.
const HERO_PHOTO =
  "https://images.unsplash.com/photo-1738156674456-97cdf7793bb7?auto=format&fit=crop&w=1400&q=70";
const HERO_PHOTO_PAGE = "https://unsplash.com/photos/a-group-of-people-standing-next-to-each-other-zddcsUv2DUE";

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
    <div className="space-y-8">
      <section className="relative isolate h-56 overflow-hidden rounded-2xl bg-gradient-to-r from-royal via-cobalt to-lapis text-white sm:h-60">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_PHOTO}
          alt="Friends singing together in a karaoke room"
          className="absolute inset-y-0 right-0 -z-10 h-full w-full object-cover text-transparent sm:w-3/5"
        />
        <div className="absolute inset-0 -z-10 bg-royal/75 sm:bg-transparent sm:bg-gradient-to-r sm:from-royal sm:from-40% sm:via-royal/70 sm:via-55% sm:to-transparent" />
        <div className="dot-grid absolute inset-0 -z-10" />
        <div className="flex h-full flex-col justify-center gap-2 px-6 sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-kicker">
            Gaana · Bajaana · Mehfil
          </p>
          <h1 className="max-w-[15ch] font-display text-3xl leading-tight text-balance sm:text-5xl">
            Your weekend mehfil is calling
          </h1>
          <p className="max-w-[40ch] text-white/85">
            Find a karaoke night near you and sing the songs you grew up with.
          </p>
        </div>
        <a
          href={HERO_PHOTO_PAGE}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-3 bottom-2 text-[11px] text-white/70 hover:text-white"
        >
          Photo: Singa Karaoke / Unsplash
        </a>
      </section>

      <section>
        <h2 className="mb-4 font-display text-2xl text-royal sm:text-3xl">Upcoming karaoke nights</h2>

        {dates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-ink-muted">
            No upcoming events yet. Check back soon.
          </p>
        ) : (
          <EventDateList dates={dates} />
        )}
      </section>
    </div>
  );
}
