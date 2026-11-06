import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/app/admin/Breadcrumbs";
import { updateDate } from "@/app/admin/actions";
import DateForm from "@/components/admin/DateForm";
import { secondaryButton } from "@/components/ui";
import { bannerFor } from "@/lib/banner";
import { formatEventDate } from "@/lib/format";
import { parseRounds, roundsFor } from "@/lib/rounds";
import { pacificDateOf, pacificTimeOf } from "@/lib/schedule";
import { prisma } from "@/lib/prisma";
import { requireGroupAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";

/** One date's own settings: when it is, and anything it changes from the event template. */
export default async function DateSettingsPage({ params }: { params: Promise<{ dateId: string }> }) {
  const { dateId } = await params;
  const date = await prisma.eventDate.findUnique({
    where: { id: dateId },
    include: { series: { include: { group: true } } },
  });
  if (!date || date.status === "DELETED") notFound();
  await requireGroupAdmin(date.series.groupId, `/admin/dates/${dateId}/settings`);
  const { series } = date;
  const back = `/admin/dates/${date.id}`;

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs
          items={[
            { href: "/admin", label: "Admin" },
            { href: `/admin/groups/${series.groupId}`, label: series.group.name },
            { href: `/admin/events/${series.id}`, label: series.title },
            { href: back, label: formatEventDate(date.startsAt) },
            { label: "Settings" },
          ]}
        />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-royal">Settings for {formatEventDate(date.startsAt)}</h1>
            <p className="text-ink-muted">
              This date uses the event template settings. Tick &ldquo;Change for this date&rdquo; to override one for
              this date only; later changes to the event template won&apos;t touch it.
            </p>
          </div>
          <Link href={back} className={secondaryButton}>
            Back to sign-ups
          </Link>
        </div>
      </div>
      <DateForm
        action={updateDate.bind(null, date.id)}
        date={date}
        template={{
          description: series.description,
          singerPriceCents: series.singerPriceCents,
          listenerPriceCents: series.listenerPriceCents,
          maxSingers: series.maxSingers,
          maxListeners: series.maxListeners,
        }}
        rounds={roundsFor(date, series)}
        templateRounds={parseRounds(series.rounds)}
        templateBanner={bannerFor(series.bannerUrl, series.group.bannerUrl)}
        templateZelle={{ name: series.zelleName, handle: series.zelleHandle }}
        templateSongLock={series.songLock}
        when={{
          day: pacificDateOf(date.startsAt),
          startTime: pacificTimeOf(date.startsAt),
          endTime: pacificTimeOf(date.endsAt),
        }}
      />
    </div>
  );
}
