import Link from "next/link";
import type { SlotMode } from "@prisma/client";
import { clearSlot } from "@/app/admin/checkin-actions";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { cardClass } from "@/components/ui";
import { SLOT_MODE_LABEL } from "@/lib/slots";

export type RunningOrderRound = {
  round: number;
  mode: SlotMode;
  rows: { slot: number; signUpId: string; name: string; song: string | null; method: SlotMode }[];
  /** Checked-in singers who haven't got a slot yet. */
  waiting: string[];
};

/** Admin view of each round's running order, by slot. */
export default function RunningOrder({ rounds, seriesId }: { rounds: RunningOrderRound[]; seriesId: string }) {
  return (
    <section className={`${cardClass} space-y-5`}>
      <div>
        <h2 className="mb-1 text-xl font-semibold">Running order</h2>
        <p className="text-sm text-ink-muted">
          Singers get a slot in each round after they check in.{" "}
          <Link href={`/admin/events/${seriesId}`} className="text-cobalt hover:underline">
            Change how slots work
          </Link>{" "}
          in the event settings.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {rounds.map((r) => (
          <div key={r.round} className="space-y-2">
            <h3 className="font-semibold text-royal">
              Round {r.round} <span className="text-sm font-normal text-ink-muted">· {SLOT_MODE_LABEL[r.mode]}</span>
            </h3>
            {r.rows.length === 0 ? (
              <p className="text-sm text-ink-muted">No slots taken yet.</p>
            ) : (
              <ol className="divide-y divide-line rounded-lg border border-line">
                {r.rows.map((row) => (
                  <li key={row.slot} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span>
                      <span className="mr-2 font-semibold text-royal">{row.slot}.</span>
                      <span className="font-medium">{row.name}</span>
                      <span className="text-ink-muted">
                        {row.song ? ` · ${row.song}` : " · no song yet"}
                        {row.method === "PICK" ? " · picked" : " · check-in order"}
                      </span>
                    </span>
                    {row.method === "PICK" && (
                      <ConfirmButton
                        action={clearSlot.bind(null, row.signUpId, r.round)}
                        label="Free slot"
                        danger={false}
                        confirm={`Free slot ${row.slot}? ${row.name} will need to pick a slot again.`}
                      />
                    )}
                  </li>
                ))}
              </ol>
            )}
            {r.waiting.length > 0 && (
              <p className="text-sm text-amber-800">Checked in, no slot picked yet: {r.waiting.join(", ")}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
