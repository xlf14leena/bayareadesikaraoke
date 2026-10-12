import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { primaryButton } from "@/components/ui";
import { HOLDS_SPOT, mapUrl } from "@/lib/events";
import { formatEventDate, formatEventTime, formatPrice } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { canAdminGroup, getViewer } from "@/lib/roles";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ dateId: string }>; searchParams: Promise<{ k?: string }> };

async function load(dateId: string) {
  return prisma.eventDate.findUnique({
    where: { id: dateId },
    include: { series: { include: { group: true } } },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const date = await load((await params).dateId);
  if (!date || date.series.visibility === "PRIVATE") return { title: "Bay Area Desi Karaoke" };
  return { title: `${date.series.title} · ${formatEventDate(date.startsAt)} · Bay Area Desi Karaoke` };
}

// Event page (spec: "Dashboard, event pages and private links"). Private
// events open only with the link's key, for the group's admins, or for people
// who signed up.
export default async function EventPage({ params, searchParams }: Props) {
  const { dateId } = await params;
  const { k } = await searchParams;
  const [date, viewer] = await Promise.all([load(dateId), getViewer()]);
  if (!date) notFound();
  const { series } = date;
  const isAdmin = canAdminGroup(viewer, series.groupId);

  if (series.visibility === "PRIVATE" && !isAdmin) {
    const hasKey = !!k && k === series.privateToken;
    const signedUp =
      !!viewer && (await prisma.signUp.count({ where: { eventDateId: date.id, userId: viewer.id } })) > 0;
    if (!hasKey && !signedUp) notFound();
  }

  const [held, singers] = await Promise.all([
    prisma.signUp.groupBy({
      by: ["role"],
      where: { eventDateId: date.id, status: { in: HOLDS_SPOT } },
      _count: true,
    }),
    viewer
      ? prisma.song.findMany({
          where: { eventDateId: date.id, status: "ACTIVE", signUp: { status: "CONFIRMED" } },
          orderBy: [{ round: "asc" }, { enteredAt: "asc" }],
          include: { signUp: { select: { displayName: true } } },
        })
      : Promise.resolve([]),
  ]);
  const taken = (role: "SINGER" | "LISTENER") => held.find((h) => h.role === role)?._count ?? 0;
  const confirmedListeners = viewer
    ? await prisma.signUp.count({ where: { eventDateId: date.id, role: "LISTENER", status: "CONFIRMED" } })
    : 0;

  const banner = date.bannerUrl ?? series.bannerUrl ?? series.group.bannerUrl;
  const cancelled = date.status === "CANCELLED";
  const past = date.endsAt < new Date();
  const here = `/e/${date.id}${k ? `?k=${encodeURIComponent(k)}` : ""}`;
  const rounds = [1, 2].map((r) => singers.filter((s) => s.round === r)).filter((list) => list.length > 0);

  return (
    <article className="space-y-6">
      {banner ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={banner} alt="" className="h-44 w-full rounded-2xl object-cover sm:h-64" />
      ) : (
        <div className="h-24 overflow-hidden rounded-2xl bg-gradient-to-r from-royal via-cobalt to-lapis sm:h-32">
          <div className="dot-grid h-full w-full" />
        </div>
      )}

      <header>
        <p className="text-sm font-medium text-ink-muted">
          <Link href={`/g/${series.group.slug}`} className="hover:text-cobalt">
            {series.group.name}
          </Link>
          {series.visibility === "PRIVATE" && <span> · Private event</span>}
        </p>
        <h1 className="font-display text-3xl leading-tight text-royal sm:text-4xl">{series.title}</h1>
        <p className="text-lg text-lapis">Theme: {date.theme}</p>
        {cancelled && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 font-medium text-red-700">This date has been cancelled.</p>
        )}
        {isAdmin && (
          <p className="mt-2 text-sm">
            <Link href={`/admin/dates/${date.id}`} className="font-medium text-cobalt hover:underline">
              Manage this date →
            </Link>
          </p>
        )}
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-4 rounded-xl border border-line bg-white p-4 sm:p-6 md:col-span-2">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">When</dt>
              <dd>
                {formatEventDate(date.startsAt)}
                <br />
                {formatEventTime(date.startsAt, date.endsAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Where</dt>
              <dd>
                {series.venueName}
                <br />
                <a
                  href={mapUrl(series.venueAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cobalt hover:underline"
                >
                  {series.venueAddress}
                </a>
              </dd>
            </div>
          </dl>
          {series.description && <p className="whitespace-pre-line text-ink">{series.description}</p>}
        </div>

        <aside className="space-y-3 rounded-xl border border-line bg-white p-4 sm:p-6">
          <PriceRow label="Singer" cents={date.singerPriceCents} taken={taken("SINGER")} cap={date.maxSingers} />
          <PriceRow label="Listener" cents={date.listenerPriceCents} taken={taken("LISTENER")} cap={date.maxListeners} />
          {/* Sign-up button and the member's own status arrive with the sign-ups build step. */}
          {!cancelled && !past &&
            (viewer ? (
              <p className="rounded-lg bg-mist px-3 py-2 text-sm text-ink-muted">Sign-ups open soon.</p>
            ) : (
              <Link href={`/signin?callbackUrl=${encodeURIComponent(here)}`} className={`${primaryButton} w-full`}>
                Sign in to sign up
              </Link>
            ))}
        </aside>
      </div>

      <section className="rounded-xl border border-line bg-white p-4 sm:p-6">
        <h2 className="mb-3 text-xl font-semibold">Who&apos;s singing</h2>
        {!viewer ? (
          <p className="text-ink-muted">
            <Link href={`/signin?callbackUrl=${encodeURIComponent(here)}`} className="font-medium text-cobalt hover:underline">
              Sign in
            </Link>{" "}
            to see who has signed up and the songs they picked.
          </p>
        ) : rounds.length === 0 ? (
          <p className="text-ink-muted">No confirmed singers yet.</p>
        ) : (
          <div className="space-y-4">
            {rounds.map((list) => (
              <div key={list[0].round}>
                {rounds.length > 1 && <h3 className="mb-1 font-semibold text-royal">Round {list[0].round}</h3>}
                <ol className="list-decimal space-y-1 pl-5">
                  {list.map((s) => (
                    <li key={s.id}>
                      <span className="font-medium">{s.signUp.displayName}</span>
                      <span className="text-ink-muted">
                        {" "}
                        · {s.title}
                        {s.artist && ` (${s.artist})`}
                      </span>
                      {s.youtubeUrl && (
                        <a
                          href={s.youtubeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-sm text-cobalt hover:underline"
                        >
                          Track
                        </a>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
        {viewer && (
          <p className="mt-4 text-sm text-ink-muted">
            {confirmedListeners} {confirmedListeners === 1 ? "listener" : "listeners"} coming.
          </p>
        )}
      </section>
    </article>
  );
}

function PriceRow({ label, cents, taken, cap }: { label: string; cents: number; taken: number; cap: number | null }) {
  const left = cap == null ? null : Math.max(cap - taken, 0);
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div>
        <p className="font-medium">{label}</p>
        {left != null && (
          <p className="text-xs text-ink-muted">{left === 0 ? "Full: waitlist only" : `${left} of ${cap} spots left`}</p>
        )}
      </div>
      <p className="text-lg font-semibold">{formatPrice(cents)}</p>
    </div>
  );
}
