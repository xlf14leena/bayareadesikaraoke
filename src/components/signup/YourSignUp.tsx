import type { Group, SignUp, Song } from "@prisma/client";
import { leaveSignUp, saveSongs, uploadScreenshot } from "@/app/g/[slug]/[event]/actions";
import ConfirmButton from "@/components/admin/ConfirmButton";
import ScreenshotForm from "@/components/signup/ScreenshotForm";
import SongsForm, { type SongDefaults } from "@/components/signup/SongsForm";
import { cardClass } from "@/components/ui";
import { STATUS_LABEL } from "@/lib/events";
import { formatDateTime, formatPrice } from "@/lib/format";
import { PICKS_SONGS } from "@/lib/signups";

type Props = {
  signUp: SignUp & { songs: Song[]; screenshot: { uploadedAt: Date } | null };
  group: Pick<Group, "name" | "zelleName" | "zelleHandle">;
  waitlistPosition: number | null;
  editable: boolean;
};

const TONE: Record<string, string> = {
  CONFIRMED: "bg-emerald-50 text-emerald-800",
  UNDER_REVIEW: "bg-amber-50 text-amber-800",
  RESERVED: "bg-amber-50 text-amber-800",
  REJECTED: "bg-red-50 text-red-700",
  WAITLISTED: "bg-mist text-ink",
};

/** The signed-in person's own sign-up for this date: status, how to pay, and their songs. */
export default function YourSignUp({ signUp, group, waitlistPosition, editable }: Props) {
  const role = signUp.role === "SINGER" ? "singer" : "listener";
  const needsProof = signUp.status === "RESERVED" || signUp.status === "REJECTED";
  const active = signUp.songs.filter((s) => s.status === "ACTIVE");
  const rejected = signUp.songs.filter(
    (s) => s.status === "REJECTED" && !active.some((a) => a.round === s.round),
  );
  const defaults: Record<number, SongDefaults | undefined> = {};
  for (const s of active) defaults[s.round] = { title: s.title, artist: s.artist ?? "", youtubeUrl: s.youtubeUrl ?? "" };
  const canLeave = ["WAITLISTED", "RESERVED", "REJECTED", "UNDER_REVIEW"].includes(signUp.status);

  return (
    <section id="your-sign-up" className={`${cardClass} space-y-5`}>
      <div>
        <h2 className="text-xl font-semibold">Your sign-up</h2>
        <p className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-medium ${TONE[signUp.status] ?? "bg-mist"}`}>
          {STATUS_LABEL[signUp.status]} · {role}
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          Signed up as {signUp.displayName} on {formatDateTime(signUp.registeredAt)}.
        </p>
      </div>

      {signUp.status === "WAITLISTED" && (
        <p>
          You&apos;re number {waitlistPosition ?? "?"} on the {role} waitlist. If a spot opens up you&apos;ll move into
          it and get 24 hours to pay. Singers pick songs once they have a spot.
        </p>
      )}

      {signUp.status === "CONFIRMED" && (
        <p>
          You&apos;re in! {signUp.role === "SINGER" ? "Your songs show on the singer list below." : "See you there."}
          {signUp.paymentNote && <span className="text-ink-muted"> ({signUp.paymentNote})</span>}
        </p>
      )}

      {signUp.status === "UNDER_REVIEW" && (
        <p>
          Thanks! The organizers will check your payment
          {signUp.screenshot && <> (screenshot sent {formatDateTime(signUp.screenshot.uploadedAt)})</>}. Your spot is
          held while they review it. Once they approve it, you and your songs show on the singer list below.
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
                {group.zelleHandle ? (
                  <>
                    <span className="font-medium">{group.zelleName ?? group.name}</span>
                    <br />
                    <span className="select-all font-mono">{group.zelleHandle}</span>
                  </>
                ) : (
                  <span className="text-red-700">
                    {group.name} hasn&apos;t added its Zelle details yet. Please contact the organizers.
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
          <summary className="cursor-pointer text-cobalt">Sent the wrong screenshot? Replace it</summary>
          <div className="mt-2">
            <ScreenshotForm action={uploadScreenshot.bind(null, signUp.id)} label="Replace screenshot" />
          </div>
        </details>
      )}

      {signUp.role === "SINGER" && PICKS_SONGS.includes(signUp.status) && (
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold">Your songs</h3>
            <p className="text-sm text-ink-muted">
              Pick one song per round. First pick wins: a song someone already picked for this date can&apos;t be
              picked again. You can change your songs until sign-ups close.
            </p>
          </div>
          {rejected.map((s) => (
            <p key={s.id} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              The organizers turned down your round {s.round} song &ldquo;{s.title}&rdquo;
              {s.rejectReason && <>: {s.rejectReason}</>}. Please pick another.
            </p>
          ))}
          {editable ? (
            <SongsForm action={saveSongs.bind(null, signUp.id)} defaults={defaults} />
          ) : active.length ? (
            <ul className="text-sm">
              {active.map((s) => (
                <li key={s.id}>
                  Round {s.round}: {s.title}
                  {s.artist && ` (${s.artist})`}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">No songs picked.</p>
          )}
        </div>
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
        <p className="text-sm text-ink-muted">Can&apos;t make it? Contact the organizers to cancel.</p>
      )}
    </section>
  );
}
