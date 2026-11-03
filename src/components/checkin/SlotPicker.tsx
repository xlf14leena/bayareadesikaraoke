"use client";

import { useFormAction } from "@/components/admin/useFormAction";
import { inputClass, primaryButton, secondaryButton } from "@/components/ui";
import type { FormState } from "@/lib/forms";

/** A singer's slot choice for one round: the free slots, and a button. */
export default function SlotPicker({
  action,
  free,
  changing,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  free: number[];
  changing: boolean;
}) {
  const { state, onSubmit, pending } = useFormAction(action);
  if (free.length === 0) {
    return <p className="text-ink-muted">{changing ? "No other slots are free." : "Every slot is taken. Please talk to the organizers."}</p>;
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="slot">
        Slot
      </label>
      <select name="slot" required defaultValue="" className={`${inputClass} w-auto`}>
        <option value="" disabled>
          {changing ? "Move to slot…" : "Pick a slot…"}
        </option>
        {free.map((n) => (
          <option key={n} value={n}>
            Slot {n}
          </option>
        ))}
      </select>
      <button type="submit" className={changing ? secondaryButton : primaryButton} disabled={pending}>
        {pending ? "Saving…" : changing ? "Move" : "Take this slot"}
      </button>
      {state?.error && !pending && (
        <p role="alert" className="w-full text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
