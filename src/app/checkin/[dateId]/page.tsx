import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import CheckInButton from "@/components/checkin/CheckInButton";
import YourSlots from "@/components/checkin/YourSlots";
import { singerRounds } from "@/lib/slots";
import { cardClass } from "@/components/ui";
import { CAN_CHECK_IN, PASS_COOKIE, checkInIsOpen, checkInOpensAt, passIsValid } from "@/lib/checkin";
import { eventPath } from "@/lib/event-url";
import { formatClock, formatEventDate } from "@/lib/format";
import { pacificTimeOf } from "@/lib/schedule";
import { prisma } from "@/lib/prisma";
import { requireViewer } from "@/lib/roles";
import { checkInAtVenue } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Check in · Bay Area Desi Karaoke", robots: { index: false } };

type Props = { params: Promise<{ dateId: string }>; searchParams: Promise<{ scan?: string }> };

// Where a guest lands after scanning the venue QR code (via ./scan/route.ts).
export default async function CheckInPage({ params, searchParams }: Props) {
  const { dateId } = await params;
  const { scan } = await searchParams;
  const viewer = await requireViewer(`/checkin/${dateId}`);
  const date = await prisma.eventDate.findUnique({
    where: { id: dateId },
    include: { series: { include: { group: { select: { slug: true, name: true } } } } },
  });
  if (!date || date.status === "DELETED") notFound();
  const signUp = await prisma.signUp.findUnique({
    where: { eventDateId_userId: { eventDateId: dateId, userId: viewer.id } },
  });
  const open = checkInIsOpen(date);
  const hasPass = open && passIsValid(dateId, date.checkInSecret!, (await cookies()).get(PASS_COOKIE)?.value);
  const at = (d: Date) => formatClock(pacificTimeOf(d));
  // No private key here: people signed up can open a private event page without it.
  const eventHref = eventPath(date);

  const rounds =
    signUp?.checkedInAt && signUp.role === "SINGER" && CAN_CHECK_IN.includes(signUp.status) && date.endsAt > new Date()
      ? await singerRounds(prisma, dateId, signUp.id, date.series, date)
      : null;

  let body: React.ReactNode;
  if (signUp?.checkedInAt) {
    body = (
      <div className="rounded-lg bg-emerald-50 px-4 py-5 text-center text-emerald-800">
        <p className="text-4xl" aria-hidden>
          ✓
        </p>
        <p className="text-xl font-semibold">You&apos;re checked in</p>
        <p>
          {signUp.displayName}, at {at(signUp.checkedInAt)}. Enjoy the show!
        </p>
      </div>
    );
  } else if (!signUp || !CAN_CHECK_IN.includes(signUp.status)) {
    body = (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
        {signUp?.status === "WAITLISTED"
          ? "You're on the waitlist for this event, so there's no spot to check in to. Please talk to the organizers."
          : `We couldn't find a sign-up for ${viewer.email ?? "your account"} for this event. If you signed up with another Google account, sign in with that one, or talk to the organizers.`}
      </p>
    );
  } else if (!open) {
    body = (
      <p className="rounded-lg bg-mist px-3 py-2 text-ink-muted">
        {date.endsAt < new Date()
          ? "This event has ended."
          : `Check-in isn't open yet. The organizers open it at the venue, from ${at(checkInOpensAt(date))}.`}
      </p>
    );
  } else if (!hasPass) {
    body = (
      <p className="rounded-lg bg-mist px-3 py-2 text-ink">
        {scan === "expired"
          ? "That code has expired. Scan the code on the check-in screen again."
          : "To check in, scan the QR code on the check-in screen at the venue."}
      </p>
    );
  } else {
    body = (
      <div className="space-y-3">
        <p>
          Checking in <span className="font-semibold">{signUp.displayName}</span> (
          {signUp.role === "SINGER" ? "singer" : "listener"}).
        </p>
        <CheckInButton action={checkInAtVenue.bind(null, dateId)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className={`${cardClass} space-y-4`}>
        <div>
          <p className="text-sm font-medium text-ink-muted">{date.series.group.name}</p>
          <h1 className="font-display text-2xl text-royal">Check in</h1>
          <p className="text-ink-muted">
            {date.series.title} · {formatEventDate(date.startsAt)} · {date.series.venueName}
          </p>
        </div>
        {body}
      </div>
      {rounds && <YourSlots dateId={dateId} rounds={rounds} />}
      <p className="text-center text-sm">
        <Link href={eventHref} className="font-medium text-cobalt hover:underline">
          Go to the event page →
        </Link>
      </p>
    </div>
  );
}
