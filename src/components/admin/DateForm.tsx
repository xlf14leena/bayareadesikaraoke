"use client";

import type { EventDate } from "@prisma/client";
import Field from "@/components/admin/Field";
import FormStatus from "@/components/admin/FormStatus";
import ThemeFields from "@/components/admin/ThemeFields";
import { useFormAction } from "@/components/admin/useFormAction";
import { inputClass } from "@/components/ui";
import { dollars, type FormState } from "@/lib/forms";

/** Settings for one event date; they start as copies of the series' settings. */
export default function DateForm({
  action,
  date,
  when,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  date: EventDate;
  when: { day: string; startTime: string; endTime: string };
}) {
  const { state, onSubmit, pending } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="mb-2 font-semibold text-royal">When (Pacific time)</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date">
            <input name="date" type="date" required defaultValue={when.day} className={inputClass} />
          </Field>
          <Field label="Start time">
            <input name="startTime" type="time" required defaultValue={when.startTime} className={inputClass} />
          </Field>
          <Field label="End time">
            <input name="endTime" type="time" required defaultValue={when.endTime} className={inputClass} />
          </Field>
        </div>
        <p className="text-xs text-ink-muted">
          Change these to reschedule just this date. The rest of the schedule stays the same.
        </p>
      </fieldset>
      <ThemeFields theme={date.theme} required={date.themeRequired} hint="Blank for no theme on this date." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Singer price ($)">
          <input name="singerPrice" inputMode="decimal" defaultValue={dollars(date.singerPriceCents)} className={inputClass} />
        </Field>
        <Field label="Listener price ($)">
          <input name="listenerPrice" inputMode="decimal" defaultValue={dollars(date.listenerPriceCents)} className={inputClass} />
        </Field>
        <Field label="Singer cap" hint="Blank for no cap.">
          <input name="maxSingers" inputMode="numeric" defaultValue={date.maxSingers ?? ""} className={inputClass} />
        </Field>
        <Field label="Listener cap" hint="Blank for no cap.">
          <input name="maxListeners" inputMode="numeric" defaultValue={date.maxListeners ?? ""} className={inputClass} />
        </Field>
      </div>
      <Field label="Banner image link (optional)" hint="Blank uses the event's banner, or the default singing photo.">
        <input name="bannerUrl" type="url" defaultValue={date.bannerUrl ?? ""} placeholder="https://…" className={inputClass} />
      </Field>
      <FormStatus state={state} pending={pending} label="Save this date" />
    </form>
  );
}
