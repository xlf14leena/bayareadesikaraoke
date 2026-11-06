import type { DuetStatus, SignUp, Song } from "@prisma/client";
import { leaveSignUp, respondToDuet, saveSongs, uploadScreenshot } from "@/app/g/[slug]/[event]/actions";
import ConfirmButton from "@/components/admin/ConfirmButton";
import ScreenshotForm from "@/components/signup/ScreenshotForm";
import SongsForm, { type DuetPartnerOption, type SongDefaults } from "@/components/signup/SongsForm";
import { STATUS_LABEL, type ZelleDetails } from "@/lib/events";
import { formatDateTime, formatPrice } from "@/lib/format";
import type { RoundAppearances, RoundConfig } from "@/lib/rounds";
import { PICKS_SONGS } from "@/lib/signups";
import { primaryButton, secondaryButton } from "@/components/ui";

type Props = {
  signUp: SignUp & {
    songs: (Song & { duetPartner: { displayName: string } | null })[];
    screenshot: { uploadedAt: Date } | null;
  };
  /** People signed up for this date who can be picked as a duet partner. */
  partners: DuetPartnerOption[];
  /** Other singers' duets on this date that name this person as the partner (not the ones they declined). */
  duetInvites: { songId: string; round: number; title: string; singer: string; accepted: boolean }[];
  groupName: string;
  /** Where to send the payment, from the event template or this date. */
  zelle: ZelleDetails;
  waitlistPosition: number | null;
  editable: boolean;
  /** The date's rounds, for the songs form. */
  rounds: RoundConfig[];
  /** Per round, how many times each singer already sings, without this person's own songs (for "times per singer"). */
  appearances?: RoundAppearances[];
};

/** After the partner's name on your own duet. */
const DUET_NOTE: Record<DuetStatus, string> = {
  PENDING: " (waiting for them to accept)",
  ACCEPTED: "",
  DECLINED: " (they declined, pick someone else)",
};

const TONE: Record<string, string> = {
  CONFIRMED: "bg-emerald-50 text-emerald-800",
  UNDER_REVIEW: "bg-amber-50 text-amber-800",
  RESERVED: "bg-amber-50 text-amber-800",
  REJECTED: "bg-red-50 text-red-700",
  WAITLISTED: "bg-mist text-ink",
};

/** The signed-in person's own sign-up for this date: status, how to pay, and their songs. */
export default function YourSignUp({ signUp, groupName, zelle, waitlistPosition, editable, partners, duetInvites, rounds, appearances }: Props) {
  const role = signUp.role === "SINGER" ? "singer" : "listener";
  const needsProof = signUp.status === "RESERVED" || signUp.status === "REJECTED";
  const active = signUp.songs.filter((s) => s.status === "ACTIVE");
  const rejected = signUp.songs.filter(
    (s) => s.status === "REJECTED" && !active.some((a) => a.round === s.round),
  );
  const defaults: Record<number, SongDefaults | undefined> = {};
  for (const s of active) {
    defaults[s.round] = {
      title: s.title,
      artist: s.artist ?? "",
      youtubeUrl: s.youtubeUrl ?? "",
      duet: s.duet,
      duetPartnerId: s.duetPartnerId,
      duetStatus: s.duetStatus,
    };
  }
  const sorted = [...active].sort((a, b) => a.round - b.round);
  const canLeave = ["WAITLISTED", "RESERVED", "REJECTED", "UNDER_REVIEW"].includes(signUp.status);

  return (
    <section className="space-y-3 rounded-xl border border-line bg-white p-4 text-sm sm:px-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold">Your sign-up</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[signUp.status] ?? "bg-mist"}`}>
          {STATUS_LABEL[signUp.status]} · {role}
        </span>
        <span className="text-xs text-ink-muted">
          as {signUp.displayName} · {formatDateTime(signUp.registeredAt)}
        </span>
      </div>

      {signUp.status === "WAITLISTED" && (
        <p>
          You&apos;re number {waitlistPosition ?? "?"} on the {role} waitlist. If a spot opens up you&apos;ll move into
          it and get 24 hours to pay. Singers pick songs once they have a spot.
        </p>
      )}

      {signUp.status === "CONFIRMED" && (
        <p className="text-sm">
          You&apos;re in! {signUp.role === "SINGER" ? "Your songs show in the Who's coming tab." : "See you there."}
          {signUp.paymentNote && <span className="text-ink-muted"> ({signUp.paymentNote})</span>}
        </p>
      )}

      {signUp.status === "UNDER_REVIEW" && (
        <p>
          Thanks! The organizers will check your payment
          {signUp.screenshot && <> (screenshot sent {formatDateTime(signUp.screenshot.uploadedAt)})</>}. Your spot is
          held while they review it. Once they approve it, you and your songs show in the Who&apos;s coming tab.
        </p>
      )}

      {signUp.status === "REJECTED" && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-red-800">
          <p className="font-medium">The organizers couldn&apos;t confirm your payment.</p>
          {signUp.reviewReason && <p>Reason: {signUp.reviewReason}</p>}
          {signUp.reservedUntil && (
            <p className="text-sm">Upload a new screenshot by {formatDateTime(signUp.reservedUntil)} to keep your spot.</p>
          )}
        </div>
      )}

      {(signUp.status === "EXPIRED" || signUp.status === "CANCELLED") && (
        <p className="text-ink-muted">
          {signUp.status === "EXPIRED"
            ? "Your 24-hour hold ran out, so the spot was released."
            : "This sign-up was cancelled."}
        </p>
      )}

      {needsProof && (
        <div className="space-y-3 rounded-lg border border-line p-4">
          <h3 className="font-semibold">Pay with Zelle</h3>
          {signUp.status === "RESERVED" && signUp.reservedUntil && (
            <p className="text-sm">
              Your spot is held until <strong>{formatDateTime(signUp.reservedUntil)}</strong>. Pay and upload your
              screenshot before then.
            </p>
          )}
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Send to</dt>
              <dd>
                {zelle.handle ? (
                  <>
                    <span className="font-medium">{zelle.name ?? groupName}</span>
                    <br />
                    <span className="select-all font-mono">{zelle.handle}</span>
                  </>
                ) : (
                  <span className="text-red-700">
                    {groupName} hasn&apos;t added Zelle details for this event yet. Please contact the organizers.
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Amount</dt>
              <dd className="text-lg font-semibold">{formatPrice(signUp.amountDueCents)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Put this in the Zelle memo</dt>
              <dd className="select-all font-mono text-xl font-semibold tracking-wider text-royal">{signUp.memoCode}</dd>
            </div>
          </dl>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-muted">
            <li>Send the amount with Zelle from your bank app, with the memo code above.</li>
            <li>Take a screenshot of the payment confirmation.</li>
            <li>Upload it here.</li>
          </ol>
          {editable ? (
            <ScreenshotForm action={uploadScreenshot.bind(null, signUp.id)} label="Upload screenshot" />
          ) : (
            <p className="text-sm text-ink-muted">Sign-ups for this date are closed.</p>
          )}
        </div>
      )}

      {signUp.status === "UNDER_REVIEW" && editable && (
        <details className="text-sm">
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-2 text-ink-muted [&::-webkit-details-marker]:hidden">
            Sent the wrong screenshot?
            <span className={secondaryButton}>Replace it</span>
          </summary>
          <div className="mt-2">
            <ScreenshotForm action={uploadScreenshot.bind(null, signUp.id)} label="Replace screenshot" />
          </div>
        </details>
      )}

      {duetInvites.length > 0 && (
        <ul className="divide-y divide-line rounded-lg bg-lapis/5 px-3">
          {duetInvites.map((d) => (
            <li key={d.songId} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
              <span className="min-w-0 flex-1">
                {d.accepted ? (
                  <>
                    You&apos;re singing a duet with {d.singer} in round {d.round}: &ldquo;{d.title}&rdquo;
                  </>
                ) : (
                  <>
                    <span className="font-semibold">{d.singer}</span> asked you to sing a duet in round {d.round}:
                    &ldquo;{d.title}&rdquo;
                  </>
                )}
              </span>
              {editable &&
                (d.accepted ? (
                  <ConfirmButton
                    action={respondToDuet.bind(null, d.songId, false)}
                    label="Back out"
                    danger={false}
                    confirm={`Back out of the duet with ${d.singer}? They'll need to pick someone else.`}
                  />
                ) : (
                  <span className="flex gap-2">
                    <form action={respondToDuet.bind(null, d.songId, true)}>
                      <button type="submit" className={primaryButton}>
                        Accept
                      </button>
                    </form>
                    <form action={respondToDuet.bind(null, d.songId, false)}>
                      <button type="submit" className={secondaryButton}>
                        Decline
                      </button>
                    </form>
                  </span>
                ))}
            </li>
          ))}
        </ul>
      )}

      {signUp.role === "SINGER" && PICKS_SONGS.includes(signUp.status) && (
        <details open={!active.length || rejected.length > 0} className="group rounded-lg border border-line">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 space-y-0.5">
              <span className="block font-semibold">Your songs</span>
              {sorted.length ? (
                sorted.map((s) => (
                  <span key={s.id} className="flex items-baseline gap-2 text-ink-muted">
                    <span className="shrink-0 text-xs font-semibold text-royal">Round {s.round}</span>
                    <span className="truncate">
                      {s.title}
                      {s.duet && (s.duetPartner ? ` · duet with ${s.duetPartner.displayName}${DUET_NOTE[s.duetStatus ?? "ACCEPTED"]}` : " · duet")}
                    </span>
                  </span>
                ))
              ) : (
                <span className="block text-ink-muted">No songs picked yet</span>
              )}
            </span>
            {/* A labelled button, not just a caret, so it's clear the summary opens the rounds. */}
            <span className="flex shrink-0 items-center gap-1 rounded-full border border-cobalt/40 px-3 py-1 text-sm font-medium text-cobalt group-hover:bg-cobalt/10">
              <span className="group-open:hidden">{editable ? (sorted.length ? "Edit songs" : "Pick songs") : "Show rounds"}</span>
              <span className="hidden group-open:inline">Close</span>
              <span aria-hidden className="transition-transform group-open:rotate-180">
                ▾
              </span>
            </span>
          </summary>
          <div className="space-y-3 border-t border-line p-3">
            <p className="text-xs text-ink-muted">
              {rounds.length === 1 ? "Pick your song." : `Pick one song for each of the ${rounds.length} rounds.`} First pick wins: a song someone already picked for this date can&apos;t be
              picked again, even spelled a little differently. You can change your songs until sign-ups close.
            </p>
            {rejected.map((s) => (
              <p key={s.id} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                The organizers turned down your round {s.round} song &ldquo;{s.title}&rdquo;
                {s.rejectReason && <>: {s.rejectReason}</>}. Please pick another.
              </p>
            ))}
            {editable ? (
              <SongsForm
                action={saveSongs.bind(null, signUp.id)}
                rounds={rounds}
                defaults={defaults}
                partners={partners}
                appearances={appearances}
                selfId={signUp.id}
              />
            ) : active.length ? (
              <ul className="text-sm">
                {active.map((s) => (
                  <li key={s.id}>
                    Round {s.round}: {s.title}
                    {s.artist && ` (${s.artist})`}
                    {s.duet && (s.duetPartner ? ` · duet with ${s.duetPartner.displayName}${DUET_NOTE[s.duetStatus ?? "ACCEPTED"]}` : " · duet")}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">No songs picked.</p>
            )}
          </div>
        </details>
      )}

      {canLeave && (
        <ConfirmButton
          action={leaveSignUp.bind(null, signUp.id)}
          label={signUp.status === "WAITLISTED" ? "Leave the waitlist" : "Cancel my sign-up"}
          confirm={
            signUp.status === "WAITLISTED"
              ? "Leave the waitlist for this date?"
              : "Cancel your sign-up? Your spot and songs will go to someone else. If you already paid, contact the organizers about a refund."
          }
        />
      )}
      {signUp.status === "CONFIRMED" && (
        <p className="text-xs text-ink-muted">Can&apos;t make it? Contact the organizers to cancel.</p>
      )}
    </section>
  );
}
