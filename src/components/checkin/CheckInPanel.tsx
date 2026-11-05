import Link from "next/link";
import type { EventDate, SignUp } from "@prisma/client";
import { adminCheckIn, closeCheckIn, openCheckIn, undoCheckIn } from "@/app/admin/checkin-actions";
import ConfirmButton from "@/components/admin/ConfirmButton";
import CheckInList from "@/components/checkin/CheckInList";
import LiveRefresh from "@/components/checkin/LiveRefresh";
import { badgeClass, cardClass, primaryButton, secondaryButton } from "@/components/ui";
import { STATUS_LABEL } from "@/lib/events";
import { CAN_CHECK_IN, canOpenCheckIn, checkInIsOpen, checkInOpensAt } from "@/lib/checkin";
import { formatClock, formatDateTime } from "@/lib/format";
import { pacificTimeOf } from "@/lib/schedule";

type Person = Pick<SignUp, "id" | "displayName" | "role" | "status" | "checkedInAt" | "checkInMethod"> & {
  checkedInBy: { name: string | null } | null;
};

/** Check-in section of a date's admin page: open or close it, the venue screen, and the live list. */
export default function CheckInPanel({
  date,
  signUps,
}: {
  date: Pick<EventDate, "id" | "status" | "startsAt" | "endsAt" | "checkInOpenedAt" | "checkInSecret">;
  signUps: Person[];
}) {
  const now = new Date();
  const open = checkInIsOpen(date, now);
  const canOpen = canOpenCheckIn(date, now);
  const opensAt = checkInOpensAt(date);
  const byHandAllowed = now >= opensAt;
  const people = signUps.filter((s) => CAN_CHECK_IN.includes(s.status));
  const arrived = people
    .filter((s) => s.checkedInAt)
    .sort((a, b) => a.checkedInAt!.getTime() - b.checkedInAt!.getTime());
  const notYet = people
    .filter((s) => !s.checkedInAt)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const at = (d: Date) => formatClock(pacificTimeOf(d));
  const canCheckInByHand = byHandAllowed && now < date.endsAt && date.status === "SCHEDULED";
  const who = (s: Person) =>
    `${s.role === "SINGER" ? "Singer" : "Listener"}${s.status !== "CONFIRMED" ? ` · ${STATUS_LABEL[s.status]}` : ""}`;

  return (
    <section id="check-in" className={`${cardClass} space-y-5`}>
      {open && <LiveRefresh />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{open ? "Check-in is open" : "Check-in"}</h2>
          <p className="text-sm text-ink-muted">
            {open
              ? `Opened at ${at(date.checkInOpenedAt!)}. Put the check-in screen up at the venue; guests scan its QR code to check in. The code changes every 30 seconds, so a photo of it stops working within a minute.`
              : date.status !== "SCHEDULED"
                ? "This date is cancelled."
                : now >= date.endsAt
                  ? "This event has ended."
                  : canOpen
                    ? "Open check-in when you're at the venue. Guests check in by scanning the code on your check-in screen, and you can check anyone in by hand below."
                    : `You can open check-in from ${formatDateTime(opensAt)}, an hour before the start.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {open ? (
            <>
              <Link href={`/admin/dates/${date.id}/checkin`} target="_blank" className={primaryButton}>
                Show check-in screen
              </Link>
              <ConfirmButton
                action={closeCheckIn.bind(null, date.id)}
                label="Close check-in"
                danger={false}
                confirm="Close check-in? The code on the screen stops working. You can open it again."
              />
            </>
          ) : (
            canOpen && (
              <form action={openCheckIn.bind(null, date.id)}>
                <button type="submit" className={primaryButton}>
                  Open check-in
                </button>
              </form>
            )
          )}
        </div>
      </div>

      {(arrived.length > 0 || byHandAllowed) && people.length > 0 && (
        <div className="space-y-4">
          <div>
            <p className="font-semibold">
              {arrived.length} of {people.length} checked in
            </p>
            {canCheckInByHand && notYet.length > 0 && (
              <p className="text-sm text-ink-muted">
                Someone without their phone, or signed in with another account? Check them in here. Check-in
                doesn&rsquo;t need to be open for this.
              </p>
            )}
          </div>
          <CheckInList
            notYet={(canCheckInByHand ? notYet : []).map((s) => ({
              id: s.id,
              name: s.displayName,
              node: (
                <>
                  <span className="min-w-0">
                    <span className="font-medium">{s.displayName}</span> <span className="text-ink-muted">· {who(s)}</span>
                  </span>
                  <form action={adminCheckIn.bind(null, s.id)}>
                    <button type="submit" className={secondaryButton}>
                      Check in
                    </button>
                  </form>
                </>
              ),
            }))}
            arrived={arrived.map((s) => ({
              id: s.id,
              name: s.displayName,
              node: (
                <>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                    <span>
                      <span className="font-medium">{s.displayName}</span>{" "}
                      <span className="text-ink-muted">
                        · {who(s)} · {at(s.checkedInAt!)}
                      </span>
                    </span>
                    {s.checkInMethod === "ADMIN" ? (
                      <span
                        className={`${badgeClass} bg-gold/30 text-gold-ink`}
                        title={`Checked in by ${s.checkedInBy?.name ?? "an admin"}`}
                      >
                        Manual{s.checkedInBy?.name ? ` · by ${s.checkedInBy.name}` : ""}
                      </span>
                    ) : (
                      <span className={`${badgeClass} bg-lapis/10 text-cobalt`}>Scanned</span>
                    )}
                  </span>
                  <ConfirmButton
                    action={undoCheckIn.bind(null, s.id)}
                    label="Undo"
                    confirm={`Undo ${s.displayName}'s check-in? Their running-order slots are freed. They can scan again, or you can check them in here.`}
                  />
                </>
              ),
            }))}
          />
        </div>
      )}
    </section>
  );
}
