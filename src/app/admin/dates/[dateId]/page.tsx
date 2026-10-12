import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/app/admin/Breadcrumbs";
import { cancelDate, restoreDate, updateDate } from "@/app/admin/actions";
import ConfirmButton from "@/components/admin/ConfirmButton";
import DateForm from "@/components/admin/DateForm";
import { cardClass } from "@/components/ui";
import { formatEventDate, formatEventTime } from "@/lib/format";
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
  if (!date) notFound();
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
          </div>
          <Link href={viewHref} className="text-sm font-medium text-cobalt hover:underline">
            View event page →
          </Link>
        </div>
      </div>

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
        <p className="mb-4 text-sm text-ink-muted">These override the event settings for this date only.</p>
        <DateForm action={updateDate.bind(null, date.id)} date={date} />
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
    </div>
  );
}
