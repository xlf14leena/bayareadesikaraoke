import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/app/admin/Breadcrumbs";
import { cancelDate, deleteDate, restoreDate, setSignupsOpen, updateDate } from "@/app/admin/actions";
import ConfirmButton from "@/components/admin/ConfirmButton";
import DateForm from "@/components/admin/DateForm";
import { cardClass, primaryButton, secondaryButton } from "@/components/ui";
import { formatClock, formatEventDate, formatEventTime } from "@/lib/format";
import { pacificDateOf, pacificTimeOf } from "@/lib/schedule";
import { prisma } from "@/lib/prisma";
import { requireGroupAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  WAITLISTED: "Waitlisted",
  RESERVED: "Reserved",
  UNDER_REVIEW: "Payment under review",
  CONFIRMED: "Confirmed",
  REJECTED: "Payment rejected",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

export default async function DateAdminPage({ params }: { params: Promise<{ dateId: string }> }) {
  const { dateId } = await params;
  const date = await prisma.eventDate.findUnique({
    where: { id: dateId },
    include: {
      series: { include: { group: true } },
      signUps: {
        orderBy: { registeredAt: "asc" },
        include: { songs: { where: { status: "ACTIVE" }, orderBy: { round: "asc" } } },
      },
    },
  });
  if (!date || date.status === "DELETED") notFound();
  await requireGroupAdmin(date.series.groupId, `/admin/dates/${dateId}`);
  const { series } = date;
  const viewHref = `/e/${date.id}${series.visibility === "PRIVATE" && series.privateToken ? `?k=${series.privateToken}` : ""}`;

  return (
    <div className="space-y-8">
      <div>
        <Breadcrumbs
          items={[
            { href: "/admin", label: "Admin" },
            { href: `/admin/groups/${series.groupId}`, label: series.group.name },
            { href: `/admin/events/${series.id}`, label: series.title },
            { label: formatEventDate(date.startsAt) },
          ]}
        />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-royal">
              {series.title} · {formatEventDate(date.startsAt)}
            </h1>
            <p className="text-ink-muted">
              {formatEventTime(date.startsAt, date.endsAt)} · {series.venueName}
              {date.status === "CANCELLED" && <span className="ml-2 font-semibold text-red-700">Cancelled</span>}
            </p>
            {date.originalStartsAt && (
              <p className="text-sm text-ink-muted">
                Rescheduled from {formatEventDate(date.originalStartsAt)}, {formatClock(pacificTimeOf(date.originalStartsAt))}
              </p>
            )}
          </div>
          <Link href={viewHref} className="text-sm font-medium text-cobalt hover:underline">
            View event page →
          </Link>
        </div>
      </div>

      {date.status === "SCHEDULED" && (
        <section className={`${cardClass} flex flex-wrap items-center justify-between gap-3`}>
          <div>
            <h2 className="text-xl font-semibold">
              {date.signupsOpen ? "Registration is open" : "Registration is not open yet"}
            </h2>
            <p className="text-sm text-ink-muted">
              {date.signupsOpen
                ? "People can register for this date."
                : "Nobody can register for this date until you allow registration."}
            </p>
          </div>
          <form action={setSignupsOpen.bind(null, date.id, !date.signupsOpen)}>
            <button type="submit" className={date.signupsOpen ? secondaryButton : primaryButton}>
              {date.signupsOpen ? "Stop registration" : "Allow registration"}
            </button>
          </form>
        </section>
      )}

      <section className={cardClass}>
        <h2 className="mb-1 text-xl font-semibold">Sign-ups</h2>
        <p className="mb-4 text-sm text-ink-muted">
          Payment review and adding people by hand are coming in the next build step.
        </p>
        {date.signUps.length === 0 ? (
          <p className="text-sm text-ink-muted">Nobody has signed up yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {date.signUps.map((s) => (
              <li key={s.id} className="py-2">
                <p className="font-medium">
                  {s.displayName}{" "}
                  <span className="text-sm font-normal text-ink-muted">
                    · {s.role === "SINGER" ? "Singer" : "Listener"} · {STATUS_LABEL[s.status]}
                  </span>
                </p>
                {s.songs.map((song) => (
                  <p key={song.id} className="text-sm text-ink-muted">
                    Round {song.round}: {song.title}
                    {song.artist && ` (${song.artist})`}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="mb-1 text-xl font-semibold">Settings for this date</h2>
        <p className="mb-4 text-sm text-ink-muted">
          This date uses the event settings. Tick &ldquo;Change for this date&rdquo; to override one for this date
          only; later changes to the event settings won&apos;t touch it.
        </p>
        <DateForm
          action={updateDate.bind(null, date.id)}
          date={date}
          template={{
            theme: series.theme,
            themeRequired: series.themeRequired,
            description: series.description,
            singerPriceCents: series.singerPriceCents,
            listenerPriceCents: series.listenerPriceCents,
            maxSingers: series.maxSingers,
            maxListeners: series.maxListeners,
          }}
          when={{
            day: pacificDateOf(date.startsAt),
            startTime: pacificTimeOf(date.startsAt),
            endTime: pacificTimeOf(date.endsAt),
          }}
        />
      </section>

      <section className="rounded-xl border border-red-200 bg-white p-4 sm:p-6">
        {date.status === "CANCELLED" ? (
          <>
            <h2 className="mb-1 text-xl font-semibold">Restore this date</h2>
            <p className="mb-4 text-sm text-ink-muted">
              Puts it back on the event page and home page. Cancelled sign-ups stay cancelled.
            </p>
            <ConfirmButton
              action={restoreDate.bind(null, date.id)}
              label="Restore date"
              danger={false}
              confirm="Restore this date?"
            />
          </>
        ) : (
          <>
            <h2 className="mb-1 text-xl font-semibold">Cancel this date</h2>
            <p className="mb-4 text-sm text-ink-muted">
              Hides it from the home page and cancels every sign-up. Refunds happen outside the app.
            </p>
            <ConfirmButton
              action={cancelDate.bind(null, date.id)}
              label="Cancel date"
              confirm={`Cancel ${formatEventDate(date.startsAt)} and every sign-up for it?`}
            />
          </>
        )}
      </section>

      <section className="rounded-xl border border-red-200 bg-white p-4 sm:p-6">
        <h2 className="mb-1 text-xl font-semibold">Delete this date</h2>
        <p className="mb-4 text-sm text-ink-muted">
          Removes it from the site completely and cancels every sign-up. The other dates of this event stay, and
          this one won&apos;t come back.
        </p>
        <ConfirmButton
          action={deleteDate.bind(null, date.id)}
          label="Delete date"
          confirm={`Delete ${formatEventDate(date.startsAt)} and cancel every sign-up for it? This can't be undone.`}
        />
      </section>
    </div>
  );
}
