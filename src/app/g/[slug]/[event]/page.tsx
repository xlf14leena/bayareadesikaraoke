import type { Metadata } from "next";
import Link from "next/link";
import Banner from "@/components/Banner";
import Breadcrumbs from "@/components/Breadcrumbs";
import EventTabs, { type EventTab } from "@/components/EventTabs";
import { notFound, redirect } from "next/navigation";
import { primaryButton, secondaryButton } from "@/components/ui";
import { HOLDS_SPOT, mapUrl, settingsFor } from "@/lib/events";
import { formatClock, formatEventDate, formatEventTime, formatPrice } from "@/lib/format";
import { ENDED, acceptingSignUps, appearancesByRound, openRounds, settle, songLockMessage, stillEditable } from "@/lib/signups";
import { CAN_CHECK_IN, checkInIsOpen } from "@/lib/checkin";
import { pacificTimeOf } from "@/lib/schedule";
import SignUpForm from "@/components/signup/SignUpForm";
import YourSignUp from "@/components/signup/YourSignUp";
import YourSlots from "@/components/checkin/YourSlots";
import LiveRefresh from "@/components/checkin/LiveRefresh";
import PublicRunningOrder from "@/components/checkin/PublicRunningOrder";
import EventComments from "@/components/comments/EventComments";
import FeedbackPrompt from "@/components/feedback/FeedbackPrompt";
import { ROUND_KIND_LABEL, roundNumbers, roundsFor } from "@/lib/rounds";
import { paidAt, singerRounds } from "@/lib/slots";
import { duetTurns, turnName, turnSinger } from "@/lib/duet-turns";
import WhosSinging, { type LineupSong } from "@/components/signup/WhosSinging";
import { signUpForDate } from "./actions";
import { bannerFor } from "@/lib/banner";
import { zelleFor } from "@/lib/events";
import { eventPath, eventSegment, findEventDate } from "@/lib/event-url";
import { prisma } from "@/lib/prisma";
import { canAdminGroup, getViewer } from "@/lib/roles";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; event: string }>; searchParams: Promise<{ k?: string }> };

// The URL is /g/<group>/<YYYY-MM-DD>-<title> (src/lib/event-url.ts).
async function load({ slug, event }: { slug: string; event: string }) {
  const dateId = await findEventDate(slug, decodeURIComponent(event));
  if (!dateId) return null;
  return prisma.eventDate.findUnique({
    where: { id: dateId },
    include: { series: { include: { group: true } } },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const date = await load(await params);
  if (!date || date.series.visibility === "PRIVATE") return { title: "Karaoke Adda" };
  return { title: `${date.series.title} · ${formatEventDate(date.startsAt)} · Karaoke Adda` };
}

// Event page (spec: "Dashboard, event pages and private links"). Private
// events open only with the link's key, for the group's admins, or for people
// who signed up.
export default async function EventPage({ params, searchParams }: Props) {
  const route = await params;
  const { k } = await searchParams;
  const [date, viewer] = await Promise.all([load(route), getViewer()]);
  if (!date || date.status === "DELETED") notFound();
  const { series } = date;
  const isAdmin = canAdminGroup(viewer, series.groupId);
  const settings = settingsFor(date, series);
  const roundConfig = roundsFor(date, series);

  if (series.visibility === "PRIVATE" && !isAdmin) {
    const hasKey = !!k && k === series.privateToken;
    const signedUp =
      !!viewer && (await prisma.signUp.count({ where: { eventDateId: date.id, userId: viewer.id } })) > 0;
    if (!hasKey && !signedUp) notFound();
  }
  // A renamed series or moved date still opens at its old link; show the current one.
  if (decodeURIComponent(route.event) !== eventSegment(date)) redirect(eventPath(date, k));

  // Expire overdue 24-hour holds and fill freed spots from the waitlist before counting.
  if (date.status === "SCHEDULED" && date.endsAt > new Date()) await settle(date.id);

  const mine = viewer
    ? await prisma.signUp.findUnique({
        where: { eventDateId_userId: { eventDateId: date.id, userId: viewer.id } },
        include: {
          songs: {
            where: { status: { in: ["ACTIVE", "REJECTED"] } },
            orderBy: { enteredAt: "desc" },
            include: { duetPartner: { select: { displayName: true } } },
          },
        },
      })
    : null;
  const myActive = mine && !ENDED.includes(mine.status) ? mine : null;
  const waitlistPosition =
    myActive?.status === "WAITLISTED"
      ? (await prisma.signUp.count({
          where: {
            eventDateId: date.id,
            role: myActive.role,
            status: "WAITLISTED",
            waitlistedAt: { lt: myActive.waitlistedAt ?? new Date() },
          },
        })) + 1
      : null;

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
          include: {
            signUp: { select: { displayName: true } },
            duetPartner: { select: { displayName: true, status: true } },
          },
        })
      : Promise.resolve([]),
  ]);
  // Duet partners: other singers holding a spot on this date, and duets that name me.
  const [partnerSignUps, invites, appearances] = myActive
    ? await Promise.all([
        prisma.signUp.findMany({
          where: { eventDateId: date.id, role: "SINGER", status: { in: HOLDS_SPOT }, id: { not: myActive.id } },
          orderBy: { displayName: "asc" },
          select: { id: true, displayName: true },
        }),
        prisma.song.findMany({
          where: {
            duetPartnerId: myActive.id,
            duetStatus: { not: "DECLINED" },
            status: "ACTIVE",
            signUp: { status: { in: HOLDS_SPOT } },
          },
          orderBy: { round: "asc" },
          select: { id: true, round: true, title: true, duetStatus: true, signUp: { select: { displayName: true } } },
        }),
        // Only needed when a round limits how many times each singer sings.
        roundConfig.some((r) => r.maxAppearances != null)
          ? appearancesByRound(prisma, date.id, roundConfig.length, myActive.id)
          : undefined,
      ])
    : [[], [], undefined];
  const taken = (role: "SINGER" | "LISTENER") => held.find((h) => h.role === role)?._count ?? 0;
  // Everyone confirmed or waiting is listed: singers and listeners in payment order, the waitlist in its order.
  const people = viewer
    ? await prisma.signUp.findMany({
        where: { eventDateId: date.id, status: { in: ["CONFIRMED", "WAITLISTED"] } },
        select: {
          id: true,
          displayName: true,
          role: true,
          status: true,
          registeredAt: true,
          reviewedAt: true,
          waitlistedAt: true,
          paidAt: true,
        },
      })
    : [];
  const byPayment = (a: (typeof people)[number], b: (typeof people)[number]) =>
    paidAt(a) - paidAt(b) || a.registeredAt.getTime() - b.registeredAt.getTime();
  const confirmedSingers = people.filter((p) => p.role === "SINGER" && p.status === "CONFIRMED").sort(byPayment);
  const listeners = people.filter((p) => p.role === "LISTENER" && p.status === "CONFIRMED").sort(byPayment);
  const waitTime = (p: (typeof people)[number]) => (p.waitlistedAt ?? p.registeredAt).getTime();
  const waitlisted = people
    .filter((p) => p.status === "WAITLISTED")
    .sort((a, b) => waitTime(a) - waitTime(b))
    .map((p, i) => ({ id: p.id, name: p.displayName, role: p.role, place: i + 1 }));

  const myRounds =
    myActive?.checkedInAt && myActive.role === "SINGER" && CAN_CHECK_IN.includes(myActive.status) && date.endsAt > new Date()
      ? await singerRounds(prisma, date.id, myActive.id, roundConfig, date)
      : null;

  const banner = bannerFor(date.bannerUrl, series.bannerUrl, series.group.bannerUrl);
  const cancelled = date.status === "CANCELLED";
  const past = date.endsAt < new Date();
  const here = eventPath(date, k);
  const accepting = acceptingSignUps(date);
  const toReview = isAdmin
    ? await prisma.signUp.count({ where: { eventDateId: date.id, status: "UNDER_REVIEW" } })
    : 0;
  // A column per round, plus any round a past date no longer has but a song was picked for.
  const lineupRounds = [...new Set([...roundNumbers(roundConfig), ...singers.map((s) => s.round)])]
    .sort((a, b) => a - b)
    .map((round) => ({ round, config: roundConfig[round - 1] ?? null }));
  // Each confirmed singer's song per round. A round where they have no song of their own but
  // have accepted someone's duet shows that duet, so they don't read "Not picked yet".
  const lineupSingers = confirmedSingers.map((p) => {
    const songs = new Map<number, LineupSong>();
    for (const s of singers.filter((x) => x.signUpId === p.id)) {
      songs.set(s.round, {
        title: s.title,
        artist: s.artist,
        youtubeUrl: s.youtubeUrl,
        seconds: s.durationSeconds,
        duet: s.duet,
        duetWith:
          s.duetPartner && s.duetStatus === "ACCEPTED" && HOLDS_SPOT.includes(s.duetPartner.status)
            ? s.duetPartner.displayName
            : null,
        partnerPicked: s.duetPartnerId != null,
      });
    }
    for (const s of singers.filter((x) => x.duetPartnerId === p.id && x.duetStatus === "ACCEPTED" && x.duet)) {
      if (songs.has(s.round)) continue;
      songs.set(s.round, {
        title: s.title,
        artist: s.artist,
        youtubeUrl: s.youtubeUrl,
        seconds: s.durationSeconds,
        duet: true,
        duetWith: s.signUp.displayName,
        partnerPicked: true,
      });
    }
    return { id: p.id, name: p.displayName, songs };
  });
  // The running order: checked-in singers by slot, with their song for that round.
  const orderSlots = viewer
    ? await prisma.roundSlot.findMany({
        where: { eventDateId: date.id, signUp: { status: { in: HOLDS_SPOT } } },
        orderBy: [{ round: "asc" }, { slot: "asc" }],
        include: {
          signUp: {
            select: {
              displayName: true,
              songs: {
                where: { status: "ACTIVE" },
                select: {
                  round: true,
                  title: true,
                  artist: true,
                  youtubeUrl: true,
                  durationSeconds: true,
                  duet: true,
                  duetStatus: true,
                  duetPartnerId: true,
                  duetPartner: { select: { displayName: true, status: true } },
                },
              },
            },
          },
        },
      })
    : [];
  // Each slot holder's songs, once each, to merge accepted duets into one turn (src/lib/duet-turns.ts).
  const orderSongs = [...new Map(orderSlots.map((r) => [r.signUpId, r.signUp.songs.map((s) => ({ ...s, signUpId: r.signUpId }))])).values()].flat();
  const orderName = (id: string) => orderSlots.find((r) => r.signUpId === id)?.signUp.displayName ?? "?";
  const runningOrder = duetTurns(orderSlots, orderSongs).map((r) => ({
    round: r.round,
    slot: r.slot,
    signUpIds: r.pair ? [r.pair.ownerId, r.pair.partnerId] : [r.signUpId],
    name: turnName(r, orderName),
    // A duet partner shows only once they've accepted; a merged duet already names both singers.
    song: (() => {
      const song = orderSongs.find((s) => s.round === r.round && s.signUpId === turnSinger(r));
      return song
        ? { ...song, duetPartner: song.duetStatus === "ACCEPTED" && !r.pair ? song.duetPartner : null }
        : null;
    })(),
  }));
  // Before sign-ups open there's no one to list, so skip the section (it comes back if anyone is confirmed).
  const showLineup = date.signupsOpen || people.length > 0;
  const showSlots = !!myRounds && !cancelled;
  // Not signed up yet: the sign-up tab holds the sign-up form (or why you can't sign up).
  const showJoin = !myActive && !cancelled && !past;
  const showOrder = runningOrder.length > 0 && !cancelled;
  const showComments = date.commentsEnabled || isAdmin;
  const commentCount =
    viewer && showComments ? await prisma.eventComment.count({ where: { eventDateId: date.id } }) : 0;
  const singerPrice = formatPrice(settings.singerPriceCents);
  const listenerPrice = formatPrice(settings.listenerPriceCents);
  const priceLine =
    settings.singerPriceCents === settings.listenerPriceCents
      ? settings.singerPriceCents === 0
        ? "Free to sing or listen"
        : `${singerPrice} to sing or listen`
      : `Sing ${singerPrice} · Listen ${listenerPrice}`;

  const checkInNote = myActive?.checkedInAt ? (
    <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
      ✓ You checked in at {formatClock(pacificTimeOf(myActive.checkedInAt))}.
    </p>
  ) : myActive && CAN_CHECK_IN.includes(myActive.status) && checkInIsOpen(date) ? (
    <p className="rounded-lg bg-gold/30 px-3 py-2 text-sm font-medium text-gold-ink">
      Check-in is open. When you arrive, scan the QR code on the check-in screen at the venue
      {myActive.role === "SINGER" && ", then get your singing slots"}.
    </p>
  ) : null;

  // Tonight: your slots beside the running order while the event is on (just the order once it's over).
  const tonight = (showSlots || showOrder) && (
    <div className={showSlots && showOrder ? "grid items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" : ""}>
      {showSlots && (
        <div className="lg:order-2">
          <YourSlots dateId={date.id} rounds={myRounds!} />
        </div>
      )}
      {showOrder && (
        <PublicRunningOrder
          rows={runningOrder}
          mySignUpId={myActive?.id ?? null}
          now={date.nowRound != null && date.nowSlot != null && !past ? { round: date.nowRound, slot: date.nowSlot } : null}
        />
      )}
    </div>
  );

  const join = showJoin && (
    <section className="space-y-3 rounded-xl border border-line bg-white p-4 text-sm sm:px-5">
      <h2 className="text-lg font-semibold">Sign up</h2>
      {!accepting ? (
        <p className="rounded-lg bg-mist px-3 py-2 text-sm text-ink-muted">
          {date.signupsOpen ? "Sign-ups for this date are closed." : "Sign-ups aren't open yet."}
        </p>
      ) : viewer ? (
        <>
          {mine && (
            <p className="text-sm text-ink-muted">
              {mine.status === "EXPIRED"
                ? "Your earlier hold ran out. You can sign up again."
                : "Your earlier sign-up was cancelled. You can sign up again."}
            </p>
          )}
          <div className="max-w-md">
            <SignUpForm
              action={signUpForDate.bind(null, date.id, k ?? null)}
              defaultName={mine?.displayName ?? viewer.name ?? ""}
              options={[
                {
                  role: "SINGER",
                  label: "Sing",
                  price: singerPrice,
                  full: settings.maxSingers != null && taken("SINGER") >= settings.maxSingers,
                },
                {
                  role: "LISTENER",
                  label: "Listen",
                  price: listenerPrice,
                  full: settings.maxListeners != null && taken("LISTENER") >= settings.maxListeners,
                },
              ]}
            />
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-emerald-800">Sign-ups are open.</p>
          <Link
            href={`/signin?callbackUrl=${encodeURIComponent(`${here}#your-sign-up`)}`}
            className={`${primaryButton} w-full sm:w-auto`}
          >
            Sign in to sign up
          </Link>
        </>
      )}
    </section>
  );

  const yours = myActive && !cancelled && (
    <YourSignUp
      signUp={myActive}
      groupName={series.group.name}
      zelle={zelleFor(date, series)}
      waitlistPosition={waitlistPosition}
      editable={stillEditable(date)}
      openRounds={openRounds(date, roundConfig.length)}
      songLockNote={songLockMessage(date, roundConfig.length)}
      rounds={roundConfig}
      appearances={appearances}
      partners={partnerSignUps.map((p) => ({ id: p.id, name: p.displayName }))}
      duetInvites={invites.map((i) => ({
        songId: i.id,
        round: i.round,
        title: i.title,
        singer: i.signUp.displayName,
        accepted: i.duetStatus === "ACCEPTED",
      }))}
    />
  );

  const lineup = showLineup && (
    <section className="rounded-xl border border-line bg-white p-4 sm:p-6">
      <h2 className="mb-3 text-xl font-semibold">Who&apos;s coming</h2>
      {!viewer ? (
        <p className="text-ink-muted">
          <Link href={`/signin?callbackUrl=${encodeURIComponent(`${here}#whos-coming`)}`} className="font-medium text-cobalt hover:underline">
            Sign in
          </Link>{" "}
          to see who has signed up and the songs they picked.
        </p>
      ) : people.length === 0 ? (
        <p className="text-ink-muted">
          No one is confirmed yet. People show here once the organizers approve their payment.
        </p>
      ) : (
        <WhosSinging rounds={lineupRounds} singers={lineupSingers} waitlisted={waitlisted} listeners={listeners.map((p) => ({ id: p.id, name: p.displayName }))} />
      )}
    </section>
  );

  const details = (
    <section className="space-y-5 rounded-xl border border-line bg-white p-4 sm:p-6">
      <dl className="grid gap-5 sm:grid-cols-3">
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
            <a href={mapUrl(series.venueAddress)} target="_blank" rel="noopener noreferrer" className="text-cobalt hover:underline">
              {series.venueAddress}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Price</dt>
          <dd className="max-w-xs">
            <PriceRow label="Singer" cents={settings.singerPriceCents} taken={taken("SINGER")} cap={settings.maxSingers} />
            <PriceRow label="Listener" cents={settings.listenerPriceCents} taken={taken("LISTENER")} cap={settings.maxListeners} />
          </dd>
        </div>
      </dl>
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          {roundConfig.length === 1 ? "The round" : `${roundConfig.length} rounds`}
        </h2>
        <ol className="mt-2 space-y-2">
          {roundConfig.map((r, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-royal text-xs font-semibold text-white">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm text-ink-muted">{ROUND_KIND_LABEL[r.kind]}</p>
                {r.theme ? (
                  <p className="mt-0.5 border-l-4 border-gold pl-3">
                    <span className="font-medium text-royal">Theme: {r.theme}</span>
                    <span
                      className={`ml-2 inline-block rounded-full px-2 py-0.5 align-middle text-[11px] font-medium ${
                        r.themeRequired ? "bg-gold/30 text-gold-ink" : "bg-mist text-ink-muted"
                      }`}
                    >
                      {r.themeRequired ? "Songs must fit" : "Suggestion"}
                    </span>
                  </p>
                ) : (
                  <p className="mt-0.5 text-sm text-ink-muted">No theme: sing anything you like</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
      {settings.description && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">About this event</h2>
          <p className="whitespace-pre-line text-ink">{settings.description}</p>
        </div>
      )}
    </section>
  );

  // One tab shows at a time. Tabs that have nothing to show are left out.
  const tabs: (EventTab & { show: unknown })[] = [
    {
      id: "tonight",
      label: past ? "Singing order" : "Tonight",
      icon: "tonight",
      aliases: ["your-slots", "running-order", "singing-order"],
      show: tonight,
      content: tonight,
    },
    { id: "your-sign-up", label: myActive ? "Your sign-up" : "Sign up", icon: "signup", show: join || yours, content: join || yours },
    {
      id: "whos-coming",
      label: "Who's coming",
      icon: "singers",
      aliases: ["whos-singing"],
      count: confirmedSingers.length + listeners.length,
      show: lineup,
      content: lineup,
    },
    { id: "details", label: "Details", icon: "details", show: true, content: details },
    {
      id: "comments",
      label: "Comments",
      icon: "comments",
      count: commentCount,
      show: showComments,
      content: <EventComments date={date} viewer={viewer} isAdmin={isAdmin} privateKey={k ?? null} here={here} />,
    },
  ];
  const visible: EventTab[] = tabs.flatMap(({ show, ...t }) => (show ? [t] : []));
  // Open on what matters now: tonight's order and slots once they exist, then your sign-up
  // (or the form, while sign-ups are open), otherwise the details.
  const initial = tonight && !past ? "tonight" : yours || (join && accepting) ? "your-sign-up" : "details";

  return (
    <article className="space-y-6">
      <Banner {...banner} />
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: series.group.name, href: `/g/${series.group.slug}` },
          { label: `${series.title}, ${formatEventDate(date.startsAt)}` },
        ]}
      />

      <header className="!mt-3">
        {series.visibility === "PRIVATE" && <p className="text-sm font-medium text-ink-muted">Private event</p>}
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-display text-3xl leading-tight text-royal sm:text-4xl">{series.title}</h1>
          {isAdmin && (
            <Link
              href={`/admin/dates/${date.id}`}
              title="Manage this date and its sign-ups"
              className={`${secondaryButton} mt-1 sm:mt-1.5`}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Manage
            </Link>
          )}
        </div>
        {/* The key facts on one line; the Details tab has the rest. */}
        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-ink-muted">
          <li className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
            </svg>
            {formatEventDate(date.startsAt)} · {formatEventTime(date.startsAt, date.endsAt)}
          </li>
          <li className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            <a href={mapUrl(series.venueAddress)} target="_blank" rel="noopener noreferrer" className="text-cobalt hover:underline">
              {series.venueName}
            </a>
          </li>
          <li className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9a3 3 0 0 0 0 6v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a3 3 0 0 1 0-6V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3Z" />
            </svg>
            {priceLine}
          </li>
        </ul>
        {cancelled && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 font-medium text-red-700">This date has been cancelled.</p>
        )}
        {isAdmin && toReview > 0 && (
          <p className="mt-2 text-sm">
            <Link
              href={`/admin/dates/${date.id}`}
              className="inline-block rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800 hover:underline"
            >
              {toReview} {toReview === 1 ? "payment" : "payments"} to review
            </Link>
          </p>
        )}
      </header>

      <FeedbackPrompt date={date} viewer={viewer} isAdmin={isAdmin} privateKey={k ?? null} />
      {checkInNote}

      <EventTabs tabs={visible} initial={initial} />
      {showOrder && !past && <LiveRefresh everyMs={20000} />}
    </article>
  );
}

function PriceRow({ label, cents, taken, cap }: { label: string; cents: number; taken: number; cap: number | null }) {
  const left = cap == null ? null : Math.max(cap - taken, 0);
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div>
        <p>{label}</p>
        {left != null && (
          <p className="text-xs text-ink-muted">{left === 0 ? "Full: waitlist only" : `${left} of ${cap} spots left`}</p>
        )}
      </div>
      <p className="tabular-nums">{formatPrice(cents)}</p>
    </div>
  );
}
