import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { cardClass } from "@/components/ui";
import { eventPath } from "@/lib/event-url";
import { STATUS_LABEL } from "@/lib/events";
import { formatEventDate, formatEventTime, formatPrice } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireViewer } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My events · Karaoke Adda" };

const TONE: Record<string, string> = {
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  UNDER_REVIEW: "bg-amber-100 text-amber-800",
  RESERVED: "bg-amber-100 text-amber-800",
  REJECTED: "bg-red-100 text-red-700",
};

// My events (spec: "My events"): the person's upcoming and past sign-ups, with
// payment status and songs, linking back to each event page to edit.
export default async function MyEventsPage() {
  const viewer = await requireViewer("/me");
  const signUps = await prisma.signUp.findMany({
    where: { userId: viewer.id, eventDate: { status: { not: "DELETED" } } },
    include: {
      eventDate: { include: { series: { include: { group: true } } } },
      songs: { where: { status: "ACTIVE" }, orderBy: { round: "asc" } },
    },
    orderBy: { eventDate: { startsAt: "asc" } },
  });
  const now = new Date();
  const upcoming = signUps.filter((s) => s.eventDate.endsAt >= now);
  const past = signUps.filter((s) => s.eventDate.endsAt < now).reverse();

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl text-royal">My events</h1>
      <List title="Upcoming" list={upcoming} empty="You haven't signed up for any upcoming events." />
      {past.length > 0 && <List title="Past" list={past} empty="" />}
    </div>
  );
}

type Item = Prisma.SignUpGetPayload<{
  include: { eventDate: { include: { series: { include: { group: true } } } }; songs: true };
}>;

function List({ title, list, empty }: { title: string; list: Item[]; empty: string }) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold">{title}</h2>
      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-ink-muted">
          {empty}{" "}
          <Link href="/" className="font-medium text-cobalt hover:underline">
            Find a karaoke night
          </Link>
        </p>
      ) : (
        <ul className="space-y-3">
          {list.map((s) => {
            const d = s.eventDate;
            return (
              <li key={s.id}>
                <Link href={eventPath(d)} className={`${cardClass} block transition hover:border-lapis`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-ink-muted">{d.series.group.name}</p>
                      <p className="text-lg font-semibold">{d.series.title}</p>
                      <p className="text-sm text-ink-muted">
                        {formatEventDate(d.startsAt)}, {formatEventTime(d.startsAt, d.endsAt)}
                        {d.status === "CANCELLED" && <span className="ml-2 font-semibold text-red-700">Cancelled</span>}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-sm font-medium ${TONE[s.status] ?? "bg-mist text-ink"}`}>
                      {STATUS_LABEL[s.status]}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">
                    {s.role === "SINGER" ? "Singer" : "Listener"} · {formatPrice(s.amountDueCents)}
                    {s.status !== "CONFIRMED" && s.amountDueCents > 0 && (
                      <>
                        {" "}
                        · memo <span className="font-mono">{s.memoCode}</span>
                      </>
                    )}
                  </p>
                  {s.songs.map((song) => (
                    <p key={song.id} className="text-sm text-ink-muted">
                      Round {song.round}: {song.title}
                    </p>
                  ))}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
