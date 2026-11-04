import { prisma } from "@/lib/prisma";
import EventDateList from "@/components/EventDateList";

export const dynamic = "force-dynamic";

// Hero banner: the site's own artwork (public/images), with the headline that was drawn into it
// painted out so the live text below is the only copy. It carries its own dot grid.
const HERO_PHOTO = "/images/home-hero.webp";
const HERO_PHOTO_SRCSET = "/images/home-hero-1200.webp 1200w, /images/home-hero.webp 2172w";

// Public dashboard: public event dates that are happening now or upcoming, soonest first.
export default async function Home() {
  const dates = await prisma.eventDate.findMany({
    where: {
      status: "SCHEDULED",
      endsAt: { gte: new Date() },
      series: { visibility: "PUBLIC" },
    },
    orderBy: { startsAt: "asc" },
    take: 50,
    include: { series: { include: { group: true } } },
  });

  return (
    <div className="space-y-8">
      {/* Edge to edge: breaks out of the centered content column to the full window width and
          starts at the top of the window, with the header floating over it (HeaderShell); the
          text stays lined up with the column below and clears the header. */}
      <section className="relative isolate -mx-[calc(50vw-50%)] -mt-6 h-[23rem] overflow-hidden bg-gradient-to-r from-royal via-cobalt to-lapis text-white sm:h-[32rem]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_PHOTO}
          srcSet={HERO_PHOTO_SRCSET}
          sizes="100vw"
          fetchPriority="high"
          alt="Friends in kurtas and saris singing together into microphones"
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[65%_top] text-transparent sm:object-top"
        />
        {/* Darkens the photo behind the headline on the left and fades out to the right, so the text
            stays readable where it runs over the first singer while the rest of the group stays bright. */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-royal/85 via-royal/55 to-royal/10 sm:from-royal/80 sm:from-25% sm:via-royal/40 sm:via-50% sm:to-transparent sm:to-75%" />
        <div className="mx-auto flex h-full max-w-5xl flex-col justify-center gap-2 px-4 pt-16 sm:pt-20">
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
