import Link from "next/link";
import type { SlotMode } from "@prisma/client";
import { clearNowSinging, clearSlot, setNowSinging, startRound, stepNowSinging } from "@/app/admin/checkin-actions";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { cardClass, primaryButton, secondaryButton } from "@/components/ui";
import { ROUND_KIND_LABEL, type RoundKind, SLOT_MODE_LABEL } from "@/lib/rounds";

export type RunningOrderRound = {
  round: number;
  mode: SlotMode;
  kind: RoundKind;
  rows: { slot: number; signUpId: string; name: string; song: string | null; track: string | null; method: SlotMode }[];
  /** Checked-in singers who haven't got a slot yet. */
  waiting: string[];
};

/** Admin view of each round's running order, by slot, with the "now singing" controls. */
export default function RunningOrder({
  rounds,
  seriesId,
  dateId,
  now,
}: {
  rounds: RunningOrderRound[];
  seriesId: string;
  dateId: string;
  now: { round: number; slot: number } | null;
}) {
  const current = now && rounds.find((r) => r.round === now.round)?.rows.find((row) => row.slot === now.slot);
  const openRound = now?.round ?? rounds[0]?.round;
  const isNow = (round: number, slot: number) => now?.round === round && now.slot === slot;
  return (
    <section className={`${cardClass} space-y-5`}>
      <div>
        <h2 className="mb-1 text-xl font-semibold">Running order</h2>
        <p className="text-sm text-ink-muted">
          Singers get a slot in each round after they check in. Change the rounds and how slots work in{" "}
          <a href="#date-settings" className="text-cobalt hover:underline">
            this date&apos;s settings
          </a>{" "}
          or the{" "}
          <Link href={`/admin/events/${seriesId}`} className="text-cobalt hover:underline">
            event template settings
          </Link>
          .
        </p>
      </div>
      <div className="space-y-3 rounded-lg border border-gold bg-gold/15 p-3">
        <p className="font-semibold">
          {now
            ? `Now singing: Round ${now.round}, #${now.slot}${
                current ? ` · ${current.name}${current.song ? ` · ${current.song}` : ""}` : " (slot is empty)"
              }`
            : "Nobody is marked as singing yet."}
        </p>
        <div className="flex flex-wrap gap-2">
          <form action={stepNowSinging.bind(null, dateId, 1)}>
            <button type="submit" className={primaryButton}>
              {now ? "Next singer ▶" : "Start with the first singer ▶"}
            </button>
          </form>
          {rounds
            .filter((r) => r.round !== now?.round && r.rows.length > 0)
            .map((r) => (
              <form key={r.round} action={startRound.bind(null, dateId, r.round)}>
                <button type="submit" className={secondaryButton}>
                  Start round {r.round}
                </button>
              </form>
            ))}
          {now && (
            <>
              <form action={stepNowSinging.bind(null, dateId, -1)}>
                <button type="submit" className={secondaryButton}>
                  ◀ Back
                </button>
              </form>
              <form action={clearNowSinging.bind(null, dateId)}>
                <button type="submit" className={secondaryButton}>
                  Stop
                </button>
              </form>
            </>
          )}
        </div>
        <p className="text-xs text-ink-muted">
          Signed-in guests see this on the event page. A round starts at its first taken slot, so if that is #7,
          nobody can pick an earlier slot afterwards. After the last slot of a round, Next moves on to the next round.
        </p>
      </div>
      <div className="space-y-3">
        {rounds.map((r) => (
          <details key={r.round} open={r.round === openRound} className="group space-y-2">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg bg-mist px-3 py-2 font-semibold text-royal [&::-webkit-details-marker]:hidden">
              <span>
                Round {r.round}{" "}
                <span className="text-sm font-normal text-ink-muted">
                  {r.kind !== "EITHER" && `· ${ROUND_KIND_LABEL[r.kind]} `}· {SLOT_MODE_LABEL[r.mode]} · {r.rows.length} {r.rows.length === 1 ? "slot" : "slots"} taken
                </span>
              </span>
              <span aria-hidden className="text-ink-muted transition-transform group-open:rotate-180">
                ▾
              </span>
            </summary>
            {r.rows.length === 0 ? (
              <p className="text-sm text-ink-muted">No slots taken yet.</p>
            ) : (
              <ol className="divide-y divide-line rounded-lg border border-line">
                {r.rows.map((row) => (
                  <li
                    key={row.slot}
                    className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm ${
                      isNow(r.round, row.slot) ? "bg-gold/25" : ""
                    }`}
                  >
                    <span>
                      <span className="mr-2 font-semibold text-royal">{row.slot}.</span>
                      <span className="font-medium">{row.name}</span>
                      <span className="text-ink-muted">
                        {row.song ? ` · ${row.song}` : " · no song yet"}
                        {row.method === "PICK" ? " · picked" : row.method === "PAYMENT_ORDER" ? " · payment order" : " · check-in order"}
                      </span>
                      {row.track && (
                        <a
                          href={row.track}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 font-medium text-cobalt hover:underline"
                        >
                          ▶ Track
                        </a>
                      )}
                    </span>
                    <span className="flex flex-wrap gap-2">
                      {isNow(r.round, row.slot) ? (
                        <span className="rounded-full bg-royal px-3 py-1 text-xs font-semibold text-white">
                          Singing now
                        </span>
                      ) : (
                        <form action={setNowSinging.bind(null, dateId, r.round, row.slot)}>
                          <button type="submit" className={secondaryButton}>
                            Sing now
                          </button>
                        </form>
                      )}
                    {row.method === "PICK" && (
                      <ConfirmButton
                        action={clearSlot.bind(null, row.signUpId, r.round)}
                        label="Free slot"
                        danger={false}
                        confirm={`Free slot ${row.slot}? ${row.name} will need to pick a slot again.`}
                      />
                    )}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {r.waiting.length > 0 && (
              <p className="text-sm text-amber-800">Checked in, no slot picked yet: {r.waiting.join(", ")}</p>
            )}
          </details>
        ))}
      </div>
    </section>
  );
}
