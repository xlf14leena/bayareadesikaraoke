import type { Metadata } from "next";
import Link from "next/link";
import Banner from "@/components/Banner";
import Breadcrumbs from "@/components/Breadcrumbs";
import SectionTabs, { type SectionTab } from "@/components/SectionTabs";
import { notFound, redirect } from "next/navigation";
import { primaryButton } from "@/components/ui";
import { HOLDS_SPOT, STATUS_LABEL, mapUrl, settingsFor } from "@/lib/events";
import { formatClock, formatEventDate, formatEventTime, formatPrice } from "@/lib/format";
import { ENDED, acceptingSignUps, settle, stillEditable } from "@/lib/signups";
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
import { singerRounds } from "@/lib/slots";
import { signUpForDate } from "./actions";
import { bannerFor } from "@/lib/banner";
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
  if (!date || date.series.visibility === "PRIVATE") return { title: "Desi Karaoke" };
  return { title: `${date.series.title} · ${formatEventDate(date.startsAt)} · Desi Karaoke` };
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
          screenshot: { select: { uploadedAt: true } },
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
  const [partnerSignUps, invites] = myActive
    ? await Promise.all([
        prisma.signUp.findMany({
          where: { eventDateId: date.id, role: "SINGER", status: { in: HOLDS_SPOT }, id: { not: myActive.id } },
          orderBy: { displayName: "asc" },
          select: { id: true, displayName: true },
        }),
        prisma.song.findMany({
          where: { duetPartnerId: myActive.id, status: "ACTIVE", signUp: { status: { in: HOLDS_SPOT } } },
          orderBy: { round: "asc" },
          select: { round: true, title: true, signUp: { select: { displayName: true } } },
        }),
      ])
    : [[], []];
  const taken = (role: "SINGER" | "LISTENER") => held.find((h) => h.role === role)?._count ?? 0;
  const confirmedListeners = viewer
    ? await prisma.signUp.count({ where: { eventDateId: date.id, role: "LISTENER", status: "CONFIRMED" } })
    : 0;

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
  // Songs are listed by the round they were picked for, even one a past date no longer has.
  const rounds = [...new Set([...roundNumbers(roundConfig), ...singers.map((s) => s.round)])]
    .sort((a, b) => a - b)
    .map((r) => singers.filter((s) => s.round === r))
    .filter((list) => list.length > 0);
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
                  duet: true,
                  duetPartner: { select: { displayName: true, status: true } },
                },
              },
            },
          },
        },
      })
    : [];
  const runningOrder = orderSlots.map((r) => ({
    round: r.round,
    slot: r.slot,
    signUpId: r.signUpId,
    name: r.signUp.displayName,
    song: r.signUp.songs.find((s) => s.round === r.round) ?? null,
  }));
  // Before sign-ups open there's no one to list, so skip the section (it comes back if anyone is confirmed).
  const showLineup = date.signupsOpen || rounds.length > 0 || confirmedListeners > 0;
  const showSlots = !!myRounds && !cancelled;
  const showMine = !!myActive && !cancelled;
  const showOrder = runningOrder.length > 0 && !cancelled;
  // Tabs under the banner, in page order, for the sections that are showing.
  const tabs: (SectionTab & { show: boolean })[] = [
    { id: "details", label: "Details", icon: "details", show: true },
    { id: "your-slots", label: "Your slots", icon: "slots", show: showSlots },
    { id: "your-sign-up", label: "Your sign-up", icon: "signup", show: showMine },
    { id: "running-order", label: "Running order", icon: "order", show: showOrder },
    { id: "whos-singing", label: "Who's singing", icon: "singers", show: showLineup },
    { id: "comments", label: "Comments", icon: "comments", show: date.commentsEnabled || isAdmin },
  ];

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
        <h1 className="font-display text-3xl leading-tight text-royal sm:text-4xl">{series.title}</h1>
        {settings.theme ? (
          <p className="text-lg text-lapis">
            Theme: {settings.theme}
            <span className="ml-2 text-sm text-ink-muted">
              {settings.themeRequired ? "· Songs must fit the theme" : "· Theme is optional"}
            </span>
          </p>
        ) : (
          <p className="text-lg text-ink-muted">No theme: sing anything you like</p>
        )}
        {cancelled && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 font-medium text-red-700">This date has been cancelled.</p>
        )}
        {isAdmin && (
          <p className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <Link href={`/admin/dates/${date.id}`} className="font-medium text-cobalt hover:underline">
              Manage this date and its sign-ups →
            </Link>
            {toReview > 0 && (
              <Link
                href={`/admin/dates/${date.id}`}
                className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800 hover:underline"
              >
                {toReview} {toReview === 1 ? "payment" : "payments"} to review
              </Link>
            )}
          </p>
        )}
      </header>

      <SectionTabs tabs={tabs.filter((t) => t.show)} />

      <section id="details" className="space-y-5 rounded-xl border border-line bg-white p-4 sm:p-6">
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
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Price</dt>
            <dd className="max-w-xs space-y-1">
              <PriceRow
                label="Singer"
                cents={settings.singerPriceCents}
                taken={taken("SINGER")}
                cap={settings.maxSingers}
              />
              <PriceRow
                label="Listener"
                cents={settings.listenerPriceCents}
                taken={taken("LISTENER")}
                cap={settings.maxListeners}
              />
            </dd>
          </div>
        </dl>
        {settings.description && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">About this event</h2>
            <p className="whitespace-pre-line text-ink">{settings.description}</p>
          </div>
        )}

        {cancelled || past ? null : (
          <div className="space-y-3 border-t border-line pt-5">
            {myActive ? (
              <a
                href="#your-sign-up"
                className="block rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:underline"
              >
                You&apos;re signed up: {STATUS_LABEL[myActive.status].toLowerCase()}. See your sign-up ↓
              </a>
            ) : !accepting ? (
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
                        price: formatPrice(settings.singerPriceCents),
                        full: settings.maxSingers != null && taken("SINGER") >= settings.maxSingers,
                      },
                      {
                        role: "LISTENER",
                        label: "Listen",
                        price: formatPrice(settings.listenerPriceCents),
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
                  href={`/signin?callbackUrl=${encodeURIComponent(here)}`}
                  className={`${primaryButton} w-full sm:w-auto`}
                >
                  Sign in to sign up
                </Link>
              </>
            )}
          </div>
        )}
      </section>

      <FeedbackPrompt date={date} viewer={viewer} isAdmin={isAdmin} privateKey={k ?? null} />

      {myActive?.checkedInAt ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          ✓ You checked in at {formatClock(pacificTimeOf(myActive.checkedInAt))}.
        </p>
      ) : (
        myActive &&
        CAN_CHECK_IN.includes(myActive.status) &&
        checkInIsOpen(date) && (
          <p className="rounded-lg bg-gold/30 px-3 py-2 text-sm font-medium text-gold-ink">
            Check-in is open. When you arrive, scan the QR code on the check-in screen at the venue
            {myActive.role === "SINGER" && ", then get your singing slots"}.
          </p>
        )
      )}

      {myRounds && !cancelled && <YourSlots dateId={date.id} rounds={myRounds} />}

      {myActive && !cancelled && (
        <YourSignUp
          signUp={myActive}
          group={series.group}
          waitlistPosition={waitlistPosition}
          editable={stillEditable(date)}
          rounds={roundConfig}
          partners={partnerSignUps.map((p) => ({ id: p.id, name: p.displayName }))}
          duetInvites={invites.map((i) => ({ round: i.round, title: i.title, singer: i.signUp.displayName }))}
        />
      )}

      {runningOrder.length > 0 && !cancelled && (
        <PublicRunningOrder
          rows={runningOrder}
          mySignUpId={myActive?.id ?? null}
          now={date.nowRound != null && date.nowSlot != null && !past ? { round: date.nowRound, slot: date.nowSlot } : null}
        />
      )}
      {runningOrder.length > 0 && !cancelled && !past && <LiveRefresh everyMs={20000} />}

      {showLineup && (
        <section id="whos-singing" className="rounded-xl border border-line bg-white p-4 sm:p-6">
          <h2 className="mb-3 text-xl font-semibold">Who&apos;s singing</h2>
          {!viewer ? (
            <p className="text-ink-muted">
              <Link href={`/signin?callbackUrl=${encodeURIComponent(here)}`} className="font-medium text-cobalt hover:underline">
                Sign in
              </Link>{" "}
              to see who has signed up and the songs they picked.
            </p>
          ) : rounds.length === 0 ? (
            <p className="text-ink-muted">
              No confirmed singers yet. Singers show here once the organizers approve their payment.
            </p>
          ) : (
            <div className="space-y-4">
              {rounds.map((list) => (
                <div key={list[0].round}>
                  {(rounds.length > 1 || roundConfig.length > 1) && (
                    <h3 className="mb-1 font-semibold text-royal">
                      Round {list[0].round}
                      {roundConfig[list[0].round - 1]?.kind !== "EITHER" && roundConfig[list[0].round - 1] && (
                        <span className="ml-2 text-sm font-normal text-ink-muted">
                          {ROUND_KIND_LABEL[roundConfig[list[0].round - 1].kind]}
                        </span>
                      )}
                    </h3>
                  )}
                  <ol className="list-decimal space-y-1 pl-5">
                    {list.map((s) => (
                      <li key={s.id}>
                        <span className="font-medium">{s.signUp.displayName}</span>
                        <span className="text-ink-muted">
                          {" "}
                          · {s.title}
                          {s.artist && ` (${s.artist})`}
                          {s.duet &&
                            (s.duetPartner && HOLDS_SPOT.includes(s.duetPartner.status)
                              ? ` · duet with ${s.duetPartner.displayName}`
                              : " · duet")}
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
      )}

      <EventComments date={date} viewer={viewer} isAdmin={isAdmin} privateKey={k ?? null} here={here} />
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
