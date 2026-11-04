import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CheckInScreen from "@/components/checkin/CheckInScreen";
import { formatEventDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireGroupAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Check-in screen · Desi Karaoke", robots: { index: false } };

// The screen an admin puts up at the venue (phone, tablet or laptop).
export default async function CheckInScreenPage({ params }: { params: Promise<{ dateId: string }> }) {
  const { dateId } = await params;
  const date = await prisma.eventDate.findUnique({
    where: { id: dateId },
    select: { status: true, startsAt: true, series: { select: { groupId: true, title: true, venueName: true } } },
  });
  if (!date || date.status === "DELETED") notFound();
  await requireGroupAdmin(date.series.groupId, `/admin/dates/${dateId}/checkin`);
  const back = `/admin/dates/${dateId}`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-ink-muted">
        <p>
          {date.series.title} · {formatEventDate(date.startsAt)} · {date.series.venueName}
        </p>
        <Link href={back} className="font-medium text-cobalt hover:underline">
          ← Back to the date
        </Link>
      </div>
      <CheckInScreen dateId={dateId} backHref={back} />
    </div>
  );
}
