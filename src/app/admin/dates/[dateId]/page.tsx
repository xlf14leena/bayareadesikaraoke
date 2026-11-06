import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/app/admin/Breadcrumbs";
import { cancelDate, deleteDate, restoreDate, setDateArchived, setSignupsOpen } from "@/app/admin/actions";
import ConfirmButton from "@/components/admin/ConfirmButton";
import MoreMenu, { menuDangerItem, menuItem } from "@/components/admin/MoreMenu";
import SidePanel, { OpenPanelButton } from "@/components/admin/SidePanel";
import SignUpFilter, { type FilterGroup } from "@/components/admin/SignUpFilter";
import { approvePayment, addPerson, cancelSignUp, rejectPayment, rejectSong } from "@/app/admin/signup-actions";
import AddPersonForm from "@/components/admin/AddPersonForm";
import CheckInPanel from "@/components/checkin/CheckInPanel";
import RunningOrder from "@/components/checkin/RunningOrder";
import TrackLength from "@/components/TrackLength";
import { openCheckIn } from "@/app/admin/checkin-actions";
import { CAN_CHECK_IN, canOpenCheckIn, checkInIsOpen, checkInOpensAt } from "@/lib/checkin";
import { type RoundConfig, roundNumbers, roundsFor } from "@/lib/rounds";
import ReasonForm from "@/components/admin/ReasonForm";
import { cardClass, primaryButton, secondaryButton } from "@/components/ui";
import type { SignUp, Song } from "@prisma/client";
import { eventPath } from "@/lib/event-url";
import { duetTurns, turnName, turnSinger } from "@/lib/duet-turns";
import { HOLDS_SPOT, STATUS_LABEL, settingsFor, songLockFor, spotsLabel } from "@/lib/events";
import { formatClock, formatDateTime, formatEventDate, formatEventTime, formatPrice, formatTotal } from "@/lib/format";
import { appearancesByRound, settle } from "@/lib/signups";
import { looksAlike } from "@/lib/song-match";
import { feedbackOpen, feedbackSummary } from "@/lib/feedback";
import { pacificTimeOf } from "@/lib/schedule";
import { prisma } from "@/lib/prisma";
import { requireGroupAdmin } from "@/lib/roles";
import { fillSongLengths } from "@/lib/youtube";
import SubmitButton from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function DateAdminPage({ params }: { params: Promise<{ dateId: string }> }) {
  const { dateId } = await params;
  const found = await prisma.eventDate.findUnique({ where: { id: dateId }, select: { status: true, series: { select: { groupId: true } } } });
  if (!found || found.status === "DELETED") notFound();
  await requireGroupAdmin(found.series.groupId, `/admin/dates/${dateId}`);
  if (found.status === "SCHEDULED") await settle(dateId);
  // Songs picked before lengths existed, or whose lookup failed, get one here (a no-op once all are known).
  await fillSongLengths({ eventDateId: dateId }).catch(() => 0);
  const date = await prisma.eventDate.findUnique({
    where: { id: dateId },
    include: {
      series: { include: { group: true } },
      signUps: {
        orderBy: { registeredAt: "asc" },
        include: {
          songs: {
            where: { status: { in: ["ACTIVE", "REJECTED"] } },
            orderBy: [{ round: "asc" }, { enteredAt: "asc" }],
            include: { duetPartner: { select: { displayName: true } } },
          },
          reviewedBy: { select: { name: true } },
          checkedInBy: { select: { name: true } },
        },
      },
    },
  });
  if (!date) notFound();
  const { series } = date;
  const settings = settingsFor(date, series);
  const rounds = roundsFor(date, series);
  const appearances = rounds.some((r) => r.maxAppearances != null)
    ? await appearancesByRound(prisma, date.id, rounds.length)
    : undefined;
  const by = (statuses: string[]) => date.signUps.filter((s) => statuses.includes(s.status));
  const review = by(["UNDER_REVIEW"]).sort(
    (a, b) => (a.paidAt?.getTime() ?? 0) - (b.paidAt?.getTime() ?? 0),
  );
  const awaiting = by(["RESERVED", "REJECTED"]);
  const nearMatches = possibleDuplicates(date.signUps);
  const confirmed = by(["CONFIRMED"]).sort((a, b) => (a.role === b.role ? 0 : a.role === "SINGER" ? -1 : 1));
  const waitlist = by(["WAITLISTED"]).sort(
    (a, b) => (a.waitlistedAt?.getTime() ?? 0) - (b.waitlistedAt?.getTime() ?? 0),
  );
  const ended = by(["EXPIRED", "CANCELLED"]);
  const held = (role: string) => date.signUps.filter((s) => s.role === role && HOLDS_SPOT.includes(s.status)).length;
  const slotRows = await prisma.roundSlot.findMany({ where: { eventDateId: date.id }, orderBy: [{ round: "asc" }, { slot: "asc" }] });
  const arrivedSingers = date.signUps.filter(
    (s) => s.role === "SINGER" && s.checkedInAt && CAN_CHECK_IN.includes(s.status),
  );
  // The date's rounds, plus any round that still holds slots after the rounds changed (a past date).
  const activeSongs = date.signUps.flatMap((s) => s.songs.filter((x) => x.status === "ACTIVE"));
  const nameOf = (id: string) => date.signUps.find((x) => x.id === id)?.displayName ?? "?";
  const orderRounds = [...new Set([...roundNumbers(rounds), ...slotRows.map((r) => r.round)])].sort((a, b) => a - b);
  const runningOrder = orderRounds.map((round) => {
    const inRound = slotRows.filter((r) => r.round === round);
    const config = rounds[round - 1];
    return {
      round,
      mode: config?.slotMode ?? inRound[0]?.method ?? "PICK",
      kind: config?.kind ?? "EITHER",
      // An accepted duet whose partner has no song of their own in the round is one turn.
      rows: duetTurns(inRound, activeSongs).map((r) => {
        const song = activeSongs.find((x) => x.round === round && x.signUpId === turnSinger(r));
        return {
          slot: r.slot,
          signUpId: r.signUpId,
          name: turnName(r, nameOf),
          song: song?.title ?? null,
          track: song?.youtubeUrl ?? null,
          seconds: song?.durationSeconds ?? null,
          method: r.method,
        };
      }),
      waiting: arrivedSingers.filter((s) => !inRound.some((r) => r.signUpId === s.id)).map((s) => s.displayName),
    };
  });
  // Total track time of the songs picked by singers holding a spot, to plan the night.
  const heldSongs = date.signUps
    .filter((s) => HOLDS_SPOT.includes(s.status))
    .flatMap((s) => s.songs.filter((x) => x.status === "ACTIVE"));
  const songSeconds = heldSongs.reduce((sum, x) => sum + (x.durationSeconds ?? 0), 0);
  const songsWithoutLength = heldSongs.filter((x) => x.durationSeconds == null).length;
  const viewHref = eventPath(date, series.visibility === "PRIVATE" ? series.privateToken : null);
  const feedback = await feedbackSummary(date.id);
  const isPast = date.endsAt < new Date();

  const now = new Date();
  const checkInOpen = checkInIsOpen(date, now);
  const checkInReady = canOpenCheckIn(date, now);
  const checkedIn = date.signUps.filter((s) => s.checkedInAt && CAN_CHECK_IN.includes(s.status)).length;
  const showCheckIn = checkInOpen || checkInReady || checkedIn > 0;
  const scheduled = date.status === "SCHEDULED";
  const settingsHref = `/admin/dates/${date.id}/settings`;
  const row = (s: Row) => ({
    id: s.id,
    name: s.displayName,
    node: <SignUpRow s={s} rounds={rounds} nearMatches={nearMatches} />,
  });
  const groups: FilterGroup[] = [
    { key: "review", label: "Needs review", empty: "No payments waiting for review.", alert: true, rows: review.map(row) },
    { key: "awaiting", label: "Waiting to pay", empty: "Nobody is waiting to pay.", rows: awaiting.map(row) },
    { key: "confirmed", label: "Confirmed", empty: "Nobody is confirmed yet.", rows: confirmed.map(row) },
    { key: "waitlist", label: "Waitlist", empty: "Nobody is on the waitlist.", rows: waitlist.map(row) },
    { key: "ended", label: "Expired or cancelled", empty: "No expired or cancelled sign-ups.", rows: ended.map(row) },
  ];
  // Start on the first list that needs the admin, else the confirmed list.
  const firstChip = groups.find((g) => ["review", "awaiting", "waitlist"].includes(g.key) && g.rows.length > 0)?.key ?? "confirmed";

  // Less-used actions, in the "⋯" menu.
  const more = (
    <>
      {feedbackOpen(date) && (
        <Link href={`/admin/dates/${date.id}/feedback`} className={menuItem}>
          Feedback{feedback.count > 0 && ` (${feedback.count})`}
        </Link>
      )}
      <Link href={`/admin/events/${series.id}`} className={menuItem}>
        Event template
      </Link>
      {isPast && scheduled && !date.archivedAt && (
        <form action={setDateArchived.bind(null, date.id, true)}>
          <SubmitButton className={menuItem}>
            Archive date
          </SubmitButton>
        </form>
      )}
      <hr className="my-1 border-line" />
      {scheduled && (
        <ConfirmButton
          action={cancelDate.bind(null, date.id)}
          label="Cancel date…"
          className={menuDangerItem}
          confirm={`Cancel ${formatEventDate(date.startsAt)} and every sign-up for it? It's hidden from the home page. Refunds happen outside the app. You can restore the date later, but not the sign-ups.`}
        />
      )}
      <ConfirmButton
        action={deleteDate.bind(null, date.id)}
        label="Delete date…"
        className={menuDangerItem}
        confirm={`Delete ${formatEventDate(date.startsAt)} and cancel every sign-up for it? It's removed from the site and won't come back. This can't be undone.`}
      />
    </>
  );
  const dots = (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );

  return (
    <div className="space-y-5">
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
              {date.archivedAt && (
                <span className="ml-2 rounded-full bg-mist px-2 py-0.5 text-xs font-medium text-ink-muted">Archived</span>
              )}
            </p>
            {date.originalStartsAt && (
              <p className="text-sm text-ink-muted">
                Rescheduled from {formatEventDate(date.originalStartsAt)}, {formatClock(pacificTimeOf(date.originalStartsAt))}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {scheduled && (
              <OpenPanelButton panel="add-person" className={`${primaryButton} max-sm:hidden`}>
                <Icon d={ADD_PERSON} />
                Add someone
              </OpenPanelButton>
            )}
            <Link href={settingsHref} className={`${secondaryButton} max-sm:hidden`}>
              <Icon d={GEAR} />
              Settings
            </Link>
            <Link href={viewHref} className={secondaryButton}>
              <Icon d={EYE} />
              View event page
            </Link>
            <div className="max-sm:hidden">
              <MoreMenu trigger={<span className={`${secondaryButton} !px-2.5`} aria-label="More actions">{dots}</span>}>
                {more}
              </MoreMenu>
            </div>
          </div>
        </div>
      </div>

      {date.status === "CANCELLED" && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <div>
            <h2 className="font-semibold text-red-800">This date is cancelled</h2>
            <p className="text-sm text-red-800/80">
              It&apos;s hidden from the event page and home page. Restoring puts it back; cancelled sign-ups stay cancelled.
            </p>
          </div>
          <ConfirmButton action={restoreDate.bind(null, date.id)} label="Restore date" danger={false} confirm="Restore this date?" />
        </section>
      )}

      {date.archivedAt && (
        <section id="archived" className="flex scroll-mt-24 flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-4">
          <div>
            <h2 className="font-semibold">This date is archived</h2>
            <p className="text-sm text-ink-muted">
              Archived {formatDateTime(date.archivedAt)}. It&apos;s hidden from past karaoke nights on the group page; the
              event page and its sign-ups stay.
            </p>
          </div>
          <form action={setDateArchived.bind(null, date.id, false)}>
            <SubmitButton className={secondaryButton}>
              Unarchive
            </SubmitButton>
          </form>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {scheduled && (
          <Tile label="Sign-ups" dot={date.signupsOpen ? "bg-emerald-500" : "bg-line"} value={date.signupsOpen ? "Open" : "Not open yet"}>
            <form action={setSignupsOpen.bind(null, date.id, !date.signupsOpen)} className="mt-3">
              <SubmitButton className={`${date.signupsOpen ? secondaryButton : primaryButton} ${small}`}>
                {date.signupsOpen ? "Close sign-ups" : "Open sign-ups"}
              </SubmitButton>
            </form>
          </Tile>
        )}
        {scheduled && (
          <Tile
            label="Check-in"
            dot={checkInOpen ? "bg-emerald-500" : "bg-line"}
            value={checkInOpen ? `Open · ${checkedIn} here` : isPast ? "Ended" : checkInReady ? "Ready to open" : "Not yet"}
            sub={!checkInOpen && !checkInReady && !isPast ? `Opens ${formatDateTime(checkInOpensAt(date))}` : undefined}
          >
            {checkInOpen ? (
              <Link href={`/admin/dates/${date.id}/checkin`} target="_blank" className={`${primaryButton} ${small} mt-3`}>
                Show check-in screen
              </Link>
            ) : checkInReady ? (
              <form action={openCheckIn.bind(null, date.id)} className="mt-3">
                <SubmitButton className={`${primaryButton} ${small}`}>
                  Open check-in
                </SubmitButton>
              </form>
            ) : null}
          </Tile>
        )}
        <Tile label="Singers" value={spotsLabel(held("SINGER"), settings.maxSingers)} sub={spotsLeft(held("SINGER"), settings.maxSingers)}>
          <Meter taken={held("SINGER")} cap={settings.maxSingers} />
          {songSeconds > 0 && (
            <p className="mt-2 text-sm text-ink-muted">
              Songs: <span className="font-medium text-ink">{formatTotal(songSeconds)}</span>
              {songsWithoutLength > 0 && ` + ${songsWithoutLength} without a length`}
            </p>
          )}
        </Tile>
        <Tile label="Listeners" value={spotsLabel(held("LISTENER"), settings.maxListeners)} sub={spotsLeft(held("LISTENER"), settings.maxListeners)}>
          <Meter taken={held("LISTENER")} cap={settings.maxListeners} />
        </Tile>
      </div>

      {showCheckIn && <CheckInPanel date={date} signUps={date.signUps} />}

      {(slotRows.length > 0 || arrivedSingers.length > 0) && (
        <RunningOrder
          rounds={runningOrder}
          seriesId={series.id}
          dateId={date.id}
          now={date.nowRound != null && date.nowSlot != null ? { round: date.nowRound, slot: date.nowSlot } : null}
          songLock={songLockFor(date, series) === "ROUND_START" ? { lockedThrough: date.songsLockedThrough } : undefined}
        />
      )}

      <section id="sign-ups" className={`${cardClass} space-y-4`}>
        <div>
          <h2 className="mb-1 text-xl font-semibold">Sign-ups</h2>
          <p className="text-sm text-ink-muted">
            Spots count held sign-ups. People tick &ldquo;I&apos;ve paid&rdquo; instead of sending a screenshot. Find each memo code and amount (or their Zelle name) in your bank app before approving.
          </p>
        </div>
        <SignUpFilter groups={groups} initial={firstChip} />
      </section>

      {scheduled && (
        <SidePanel
          id="add-person"
          title="Add someone by hand"
          note="For people who paid in person or don't use the site. They're confirmed right away."
        >
          <AddPersonForm
            action={addPerson.bind(null, date.id)}
            rounds={rounds}
            appearances={appearances}
            partners={date.signUps
              .filter((s) => s.role === "SINGER" && HOLDS_SPOT.includes(s.status))
              .map((s) => ({ id: s.id, name: s.displayName }))}
          />
        </SidePanel>
      )}

      {/* On a phone the main actions sit in a bar at the bottom of the screen. */}
      <nav aria-label="Date actions" className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-white sm:hidden">
        <ul className="grid grid-cols-4 text-xs text-ink-muted">
          <li>
            {scheduled ? (
              <OpenPanelButton panel="add-person" className={barItem}>
                <Icon d={ADD_PERSON} className="h-5 w-5" />
                Add someone
              </OpenPanelButton>
            ) : (
              <a href="#sign-ups" className={barItem}>
                <Icon d={PEOPLE} className="h-5 w-5" />
                Sign-ups
              </a>
            )}
          </li>
          <li>
            <a href={showCheckIn ? "#check-in" : "#"} aria-disabled={!showCheckIn} className={`${barItem} ${showCheckIn ? "" : "pointer-events-none opacity-40"}`}>
              <Icon d={QR} className="h-5 w-5" />
              Check-in
            </a>
          </li>
          <li>
            <Link href={settingsHref} className={barItem}>
              <Icon d={GEAR} className="h-5 w-5" />
              Settings
            </Link>
          </li>
          <li>
            <MoreMenu up trigger={<span className={barItem}>{dots}More</span>}>
              {more}
            </MoreMenu>
          </li>
        </ul>
      </nav>
    </div>
  );
}

const small = "!px-3 !py-1 !text-[13px]";
const barItem = "flex w-full cursor-pointer flex-col items-center gap-0.5 py-2 hover:text-royal active:bg-lapis/15 active:text-royal";

const ADD_PERSON = "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6";
const PEOPLE = "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75";
const QR = "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14v2";
const EYE = "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z";
const GEAR =
  "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z";

function Icon({ d, className = "h-4 w-4" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** A status tile at the top of the page: a small label, the value, and an optional action. */
function Tile({ label, value, sub, dot, children }: { label: string; value: string; sub?: string; dot?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white p-3 sm:p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold">
        {dot && <span aria-hidden className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-full ${dot}`} />}
        {value}
      </p>
      {sub && <p className="text-sm text-ink-muted">{sub}</p>}
      {children}
    </div>
  );
}

function spotsLeft(taken: number, cap: number | null): string {
  if (cap == null) return "No limit";
  const left = cap - taken;
  return left > 0 ? `${left} ${left === 1 ? "spot" : "spots"} left` : left === 0 ? "Full" : `${-left} over the cap`;
}

/** How full a role is, as a thin bar. */
function Meter({ taken, cap }: { taken: number; cap: number | null }) {
  if (cap == null || cap <= 0) return null;
  const pct = Math.min(100, Math.round((taken / cap) * 100));
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist" aria-hidden>
      <div className={`h-full rounded-full ${taken >= cap ? "bg-gold" : "bg-lapis"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

type Row = SignUp & {
  songs: (Song & { duetPartner: { displayName: string } | null })[];
  reviewedBy: { name: string | null } | null;
};

/** Active song id -> who already has a close title, for songs whose title looks like an earlier song's. */
type NearMatches = Map<string, string>;

function possibleDuplicates(signUps: { displayName: string; songs: Song[] }[]): NearMatches {
  const songs = signUps
    .flatMap((s) => s.songs.filter((x) => x.status === "ACTIVE").map((song) => ({ song, name: s.displayName })))
    .sort((a, b) => a.song.enteredAt.getTime() - b.song.enteredAt.getTime());
  const out: NearMatches = new Map();
  songs.forEach(({ song }, i) => {
    const earlier = songs.slice(0, i).find((e) => looksAlike(e.song.title, song.title));
    if (earlier) out.set(song.id, `"${earlier.song.title}" (${earlier.name}, round ${earlier.song.round})`);
  });
  return out;
}

function SignUpRow({ s, rounds, nearMatches }: { s: Row; rounds: RoundConfig[]; nearMatches: NearMatches }) {
  const active = s.songs.filter((x) => x.status === "ACTIVE");
  const rejected = s.songs.filter((x) => x.status === "REJECTED");
  return (
    <div className="rounded-lg border border-line p-3">
      <div className="flex flex-wrap gap-4">
        <div className="min-w-0 flex-1 space-y-1 text-sm">
          <p className="text-base font-medium">
            {s.displayName}{" "}
            <span className="text-sm font-normal text-ink-muted">
              · {s.role === "SINGER" ? "Singer" : "Listener"} · {STATUS_LABEL[s.status]}
              {s.addedByAdmin && " · added by an admin"}
            </span>
          </p>
          {s.email && <p className="text-ink-muted">{s.email}</p>}
          <p>
            Memo <span className="font-mono font-semibold">{s.memoCode}</span> · {formatPrice(s.amountDueCents)} · Signed
            up {formatDateTime(s.registeredAt)}
          </p>
          {s.zelleName && (
            <p>
              Zelle name <span className="font-medium">{s.zelleName}</span>
            </p>
          )}
          {s.paidAt && <p className="text-ink-muted">Said they paid {formatDateTime(s.paidAt)}</p>}
          {s.reservedUntil && <p className="text-ink-muted">Held until {formatDateTime(s.reservedUntil)}</p>}
          {s.waitlistedAt && s.status === "WAITLISTED" && (
            <p className="text-ink-muted">On the waitlist since {formatDateTime(s.waitlistedAt)}</p>
          )}
          {s.reviewReason && <p className="text-red-700">Payment rejected: {s.reviewReason}</p>}
          {s.paymentNote && <p className="text-ink-muted">Paid: {s.paymentNote}</p>}
          {s.checkedInAt && <p className="font-medium text-emerald-700">Checked in {formatDateTime(s.checkedInAt)}</p>}
          {s.reviewedAt && s.status === "CONFIRMED" && (
            <p className="text-ink-muted">
              Confirmed {formatDateTime(s.reviewedAt)}
              {s.reviewedBy?.name && ` by ${s.reviewedBy.name}`}
            </p>
          )}
          {active.map((song) => {
            const isNew = s.status === "CONFIRMED" && !!s.reviewedAt && song.enteredAt > s.reviewedAt;
            return (
              <div key={song.id} className="rounded bg-mist px-2 py-1">
                <p>
                  Round {song.round}: <span className="font-medium">{song.title}</span>
                  {song.artist && ` (${song.artist})`}
                  {song.duet && (song.duetPartner ? ` · duet with ${song.duetPartner.displayName}` : " · duet")}
                  {song.duetPartner && song.duetStatus === "PENDING" && " (not confirmed yet)"}
                  {song.duetPartner && song.duetStatus === "DECLINED" && " (declined)"}
                  {song.youtubeUrl && (
                    <a href={song.youtubeUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-cobalt hover:underline">
                      Track
                    </a>
                  )}
                  {song.durationSeconds != null && (
                    <TrackLength seconds={song.durationSeconds} className="ml-1 text-ink-muted" />
                  )}
                  {isNew && (
                    <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-xs font-medium text-gold-ink">New song</span>
                  )}
                </p>
                {nearMatches.has(song.id) && (
                  <p className="text-xs font-medium text-red-700">
                    <span className="mr-1 rounded-full bg-red-100 px-2 py-0.5">Possible duplicate</span>
                    Close to {nearMatches.get(song.id)}, picked earlier. Reject it if it&apos;s the same song.
                  </p>
                )}
                <p className="text-xs text-ink-muted">Song time {formatDateTime(song.enteredAt)}</p>
                <ReasonForm
                  action={rejectSong.bind(null, song.id)}
                  label="Reject song"
                  placeholder={rounds[song.round - 1]?.theme ? `e.g. doesn't fit "${rounds[song.round - 1]?.theme}"` : "Reason"}
                />
              </div>
            );
          })}
          {rejected.map((song) => (
            <p key={song.id} className="text-xs text-ink-muted line-through">
              Round {song.round}: {song.title} (rejected{song.rejectReason && `: ${song.rejectReason}`})
            </p>
          ))}
          <div className="flex flex-wrap items-start gap-3 pt-1">
            {["UNDER_REVIEW", "REJECTED", "RESERVED"].includes(s.status) && (
              <form action={approvePayment.bind(null, s.id)}>
                <SubmitButton className={primaryButton}>
                  {s.status === "UNDER_REVIEW" ? "Approve payment" : "Mark as paid"}
                </SubmitButton>
              </form>
            )}
            {s.status === "UNDER_REVIEW" && (
              <div className="min-w-60 flex-1">
                <ReasonForm
                  action={rejectPayment.bind(null, s.id)}
                  label="Reject payment"
                  placeholder="e.g. amount was $15, expected $20"
                />
              </div>
            )}
            {!["EXPIRED", "CANCELLED"].includes(s.status) && (
              <ConfirmButton
                action={cancelSignUp.bind(null, s.id)}
                label="Cancel sign-up"
                confirm={`Cancel ${s.displayName}'s sign-up? Their spot and songs are released to the waitlist.`}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
