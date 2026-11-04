import { pickSlot } from "@/app/checkin/[dateId]/actions";
import SlotPicker from "@/components/checkin/SlotPicker";
import type { RoundSlotInfo } from "@/lib/slots";

/** A checked-in singer's place in each round: pick a slot, or see the one check-in or payment order gave them. */
export default function YourSlots({
  dateId,
  rounds,
  singersFree = false,
}: {
  dateId: string;
  rounds: RoundSlotInfo[];
  /** Singing is free on this date, so payment order is shown as sign-up order. */
  singersFree?: boolean;
}) {
  const auto = (mode: string) => (mode === "PAYMENT_ORDER" ? (singersFree ? "sign-up" : "payment") : "check-in");
  return (
    <section id="your-slots" className="space-y-3 rounded-xl border border-line bg-white p-4 text-sm sm:px-5">
      <h2 className="text-lg font-semibold">Your singing slots</h2>
      <ul className="space-y-3">
        {rounds.map((r) => (
          <li key={r.round} className="space-y-1">
            <p>
              <span className="font-medium">Round {r.round}: </span>
              {r.mySlot ? (
                <span className="rounded-full bg-royal px-2.5 py-0.5 text-xs font-semibold text-white">Slot {r.mySlot}</span>
              ) : r.stage === "over" ? (
                <span className="text-ink-muted">this round is over</span>
              ) : r.mode === "PICK" ? (
                <span className="text-ink-muted">pick a free slot</span>
              ) : (
                <span className="text-ink-muted">assigned in {auto(r.mode)} order</span>
              )}
              {r.mySlot && r.mode !== "PICK" && (
                <span className="ml-2 text-xs text-ink-muted">
                  by {auto(r.mode)} order
                </span>
              )}
            </p>
            {r.mode === "PICK" && r.stage === "running" && !r.myTurnPassed && (
              <p className="text-xs text-ink-muted">This round has started, so only slots after the current singer are open.</p>
            )}
            {r.mode === "PICK" && r.stage !== "over" && !r.myTurnPassed && (
              <SlotPicker
                key={`${r.mySlot}:${r.free.join(",")}`}
                action={pickSlot.bind(null, dateId, r.round)} free={r.free} changing={!!r.mySlot} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
