import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/app/admin/Breadcrumbs";
import { cancelDate, deleteDate, restoreDate, setDateArchived, setSignupsOpen, updateDate } from "@/app/admin/actions";
import ConfirmButton from "@/components/admin/ConfirmButton";
import DateForm from "@/components/admin/DateForm";
import { approvePayment, addPerson, cancelSignUp, rejectPayment, rejectSong } from "@/app/admin/signup-actions";
import AddPersonForm from "@/components/admin/AddPersonForm";
import CheckInPanel from "@/components/checkin/CheckInPanel";
import RunningOrder from "@/components/checkin/RunningOrder";
import { CAN_CHECK_IN } from "@/lib/checkin";
import { parseRounds, roundNumbers, roundsFor } from "@/lib/rounds";
import ReasonForm from "@/components/admin/ReasonForm";
import { cardClass, primaryButton, secondaryButton } from "@/components/ui";
import type { SignUp, Song } from "@prisma/client";
import { eventPath } from "@/lib/event-url";
import { bannerFor } from "@/lib/banner";
import { HOLDS_SPOT, STATUS_LABEL, settingsFor, spotsLabel } from "@/lib/events";
import { formatClock, formatDateTime, formatEventDate, formatEventTime, formatPrice } from "@/lib/format";
import { settle } from "@/lib/signups";
import { looksAlike } from "@/lib/song-match";
import { feedbackOpen, feedbackSummary } from "@/lib/feedback";
import { pacificDateOf, pacificTimeOf } from "@/lib/schedule";
import { prisma } from "@/lib/prisma";
import { requireGroupAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function DateAdminPage({ params }: { params: Promise<{ dateId: string }> }) {
  const { dateId } = await params;
  const found = await prisma.eventDate.findUnique({ where: { id: dateId }, select: { status: true, series: { select: { groupId: true } } } });
  if (!found || found.status === "DELETED") notFound();
  await requireGroupAdmin(found.series.groupId, `/admin/dates/${dateId}`);
  if (found.status === "SCHEDULED") await settle(dateId);
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
          screenshot: { select: { uploadedAt: true, contentType: true } },
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
  const by = (statuses: string[]) => date.signUps.filter((s) => statuses.includes(s.status));
  const review = by(["UNDER_REVIEW"]).sort(
    (a, b) => (a.screenshot?.uploadedAt.getTime() ?? 0) - (b.screenshot?.uploadedAt.getTime() ?? 0),
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
  const orderRounds = [...new Set([...roundNumbers(rounds), ...slotRows.map((r) => r.round)])].sort((a, b) => a - b);
  const runningOrder = orderRounds.map((round) => {
    const inRound = slotRows.filter((r) => r.round === round);
    const config = rounds[round - 1];
    return {
      round,
      mode: config?.slotMode ?? inRound[0]?.method ?? "PICK",
      kind: config?.kind ?? "EITHER",
      rows: inRound.map((r) => {
        const s = date.signUps.find((x) => x.id === r.signUpId);
        const song = s?.songs.find((x) => x.round === round && x.status === "ACTIVE");
        return { slot: r.slot, signUpId: r.signUpId, name: s?.displayName ?? "?", song: song?.title ?? null, track: song?.youtubeUrl ?? null, method: r.method };
      }),
      waiting: arrivedSingers.filter((s) => !inRound.some((r) => r.signUpId === s.id)).map((s) => s.displayName),
    };
  });
  const viewHref = eventPath(date, series.visibility === "PRIVATE" ? series.privateToken : null);
  const feedback = await feedbackSummary(date.id);
  const isPast = date.endsAt < new Date();

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
          <div className="flex flex-wrap gap-4 text-sm font-medium">
            {feedbackOpen(date) && (
              <Link href={`/admin/dates/${date.id}/feedback`} className="text-cobalt hover:underline">
                Feedback{feedback.count > 0 && ` (${feedback.count})`} →
              </Link>
            )}
            <Link href={viewHref} className="text-cobalt hover:underline">
              View event page →
            </Link>
          </div>
        </div>
      </div>

      {date.status === "SCHEDULED" && (
        <section className={`${cardClass} flex flex-wrap items-center justify-between gap-3`}>
          <div>
            <h2 className="text-xl font-semibold">
              {date.signupsOpen ? "Sign-ups are open" : "Sign-ups are not open yet"}
            </h2>
            <p className="text-sm text-ink-muted">
              {date.signupsOpen
                ? "The event page tells people they can sign up for this date."
                : "Open sign-ups when you're ready for people to sign up for this date."}
            </p>
          </div>
          <form action={setSignupsOpen.bind(null, date.id, !date.signupsOpen)}>
            <button type="submit" className={date.signupsOpen ? secondaryButton : primaryButton}>
              {date.signupsOpen ? "Close sign-ups" : "Open sign-ups"}
            </button>
          </form>
        </section>
      )}

      <CheckInPanel date={date} signUps={date.signUps} />

      {(slotRows.length > 0 || arrivedSingers.length > 0) && (
        <RunningOrder
          rounds={runningOrder}
          seriesId={series.id}
          dateId={date.id}
          now={date.nowRound != null && date.nowSlot != null ? { round: date.nowRound, slot: date.nowSlot } : null}
        />
      )}

      <section className={`${cardClass} space-y-6`}>
        <div>
          <h2 className="mb-1 text-xl font-semibold">Sign-ups</h2>
          <p className="text-sm text-ink-muted">
            Singers {spotsLabel(held("SINGER"), settings.maxSingers)} · Listeners{" "}
            {spotsLabel(held("LISTENER"), settings.maxListeners)} (counting held spots). Match each screenshot&apos;s
            memo code and amount in your bank app before approving.
          </p>
        </div>

        <SignUpGroup title="Needs review" empty="No payments waiting for review." list={review} theme={settings.theme} nearMatches={nearMatches} />
        <SignUpGroup
          title="Waiting for payment"
          empty="Nobody is waiting to pay."
          list={awaiting}
          theme={settings.theme}
          nearMatches={nearMatches}
        />
        <SignUpGroup title="Confirmed" empty="Nobody is confirmed yet." list={confirmed} theme={settings.theme} nearMatches={nearMatches} />
        {waitlist.length > 0 && <SignUpGroup title="Waitlist" empty="" list={waitlist} theme={settings.theme} nearMatches={nearMatches} />}
        {ended.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm font-medium text-ink-muted">
              Expired or cancelled ({ended.length})
            </summary>
            <div className="mt-3">
              <SignUpGroup title="" empty="" list={ended} theme={settings.theme} nearMatches={nearMatches} />
            </div>
          </details>
        )}
      </section>

      {date.status === "SCHEDULED" && (
        <section className={cardClass}>
          <h2 className="mb-1 text-xl font-semibold">Add someone by hand</h2>
          <p className="mb-4 text-sm text-ink-muted">
            For people who paid in person or don&apos;t use the site. They&apos;re confirmed right away.
          </p>
          <AddPersonForm
            action={addPerson.bind(null, date.id)}
            rounds={rounds}
            partners={date.signUps
              .filter((s) => s.role === "SINGER" && HOLDS_SPOT.includes(s.status))
              .map((s) => ({ id: s.id, name: s.displayName }))}
          />
        </section>
      )}

      <section id="date-settings" className={`${cardClass} scroll-mt-4`}>
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
          rounds={rounds}
          templateRounds={parseRounds(series.rounds)}
          templateBanner={bannerFor(series.bannerUrl, series.group.bannerUrl)}
          templateZelle={{ name: series.zelleName, handle: series.zelleHandle }}
          when={{
            day: pacificDateOf(date.startsAt),
            startTime: pacificTimeOf(date.startsAt),
            endTime: pacificTimeOf(date.endsAt),
          }}
        />
      </section>

      {isPast && date.status === "SCHEDULED" && (
        <section id="archive" className={`${cardClass} flex scroll-mt-4 flex-wrap items-center justify-between gap-3`}>
          <div>
            <h2 className="text-xl font-semibold">{date.archivedAt ? "This date is archived" : "Archive this date"}</h2>
            <p className="text-sm text-ink-muted">
              {date.archivedAt
                ? `Archived ${formatDateTime(date.archivedAt)}. It's hidden from past karaoke nights on the group page; the event page and its sign-ups stay.`
                : "Hides it from past karaoke nights on the group page. The event page and its sign-ups stay, and you can unarchive it any time."}
            </p>
          </div>
          <form action={setDateArchived.bind(null, date.id, !date.archivedAt)}>
            <button type="submit" className={secondaryButton}>
              {date.archivedAt ? "Unarchive" : "Archive"}
            </button>
          </form>
        </section>
      )}

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

type Row = SignUp & {
  songs: (Song & { duetPartner: { displayName: string } | null })[];
  screenshot: { uploadedAt: Date; contentType: string } | null;
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

function SignUpGroup({
  title,
  empty,
  list,
  theme,
  nearMatches,
}: {
  title: string;
  empty: string;
  list: Row[];
  theme: string | null;
  nearMatches: NearMatches;
}) {
  return (
    <div>
      {title && (
        <h3 className="mb-2 font-semibold text-royal">
          {title} {list.length > 0 && <span className="font-normal text-ink-muted">({list.length})</span>}
        </h3>
      )}
      {list.length === 0 ? (
        <p className="text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {list.map((s) => (
            <SignUpRow key={s.id} s={s} theme={theme} nearMatches={nearMatches} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SignUpRow({ s, theme, nearMatches }: { s: Row; theme: string | null; nearMatches: NearMatches }) {
  const active = s.songs.filter((x) => x.status === "ACTIVE");
  const rejected = s.songs.filter((x) => x.status === "REJECTED");
  const shot = s.screenshot ? `/api/screenshots/${s.id}` : null;
  const showsImage = shot && !/hei[cf]/.test(s.screenshot!.contentType);
  return (
    <li className="rounded-lg border border-line p-3">
      <div className="flex flex-wrap gap-4">
        {shot && (
          <a href={shot} target="_blank" rel="noopener noreferrer" className="shrink-0">
            {showsImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shot} alt={`Payment screenshot from ${s.displayName}`} className="h-32 w-24 rounded border border-line object-cover" />
            ) : (
              <span className="flex h-32 w-24 items-center justify-center rounded border border-line p-2 text-center text-xs text-cobalt">
                Open screenshot (HEIC)
              </span>
            )}
          </a>
        )}
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
          {s.screenshot && <p className="text-ink-muted">Screenshot sent {formatDateTime(s.screenshot.uploadedAt)}</p>}
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
                  {song.youtubeUrl && (
                    <a href={song.youtubeUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-cobalt hover:underline">
                      Track
                    </a>
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
                  placeholder={theme ? `e.g. doesn't fit "${theme}"` : "Reason"}
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
                <button type="submit" className={primaryButton}>
                  {s.status === "UNDER_REVIEW" ? "Approve payment" : "Mark as paid"}
                </button>
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
    </li>
  );
}
