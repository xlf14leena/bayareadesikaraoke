"use client";

import type { EventDate } from "@prisma/client";
import Field from "@/components/admin/Field";
import FormStatus from "@/components/admin/FormStatus";
import { useFormAction } from "@/components/admin/useFormAction";
import { inputClass } from "@/components/ui";
import { dollars, type FormState } from "@/lib/forms";

/** Settings for one event date; they start as copies of the series' settings. */
export default function DateForm({
  action,
  date,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  date: EventDate;
}) {
  const { state, onSubmit, pending } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Theme">
        <input name="theme" required defaultValue={date.theme} className={inputClass} />
      </Field>
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
      <Field label="Banner image link (optional)" hint="Blank uses the event's banner.">
        <input name="bannerUrl" type="url" defaultValue={date.bannerUrl ?? ""} placeholder="https://…" className={inputClass} />
      </Field>
      <FormStatus state={state} pending={pending} label="Save this date" />
    </form>
  );
}
