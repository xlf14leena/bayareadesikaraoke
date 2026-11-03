import { pickSlot } from "@/app/checkin/[dateId]/actions";
import SlotPicker from "@/components/checkin/SlotPicker";
import type { RoundSlotInfo } from "@/lib/slots";

/** A checked-in singer's place in each round: pick a slot, or see the one check-in order gave them. */
export default function YourSlots({ dateId, rounds }: { dateId: string; rounds: RoundSlotInfo[] }) {
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
              ) : r.mode === "PICK" ? (
                <span className="text-ink-muted">pick a free slot</span>
              ) : (
                <span className="text-ink-muted">assigned in check-in order</span>
              )}
              {r.mySlot && r.mode === "CHECKIN_ORDER" && <span className="ml-2 text-xs text-ink-muted">by check-in order</span>}
            </p>
            {r.mode === "PICK" && (
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
