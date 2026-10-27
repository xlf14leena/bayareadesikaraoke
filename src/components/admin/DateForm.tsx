"use client";

import { useState } from "react";
import type { EventDate } from "@prisma/client";
import Field from "@/components/admin/Field";
import FormStatus from "@/components/admin/FormStatus";
import ThemeFields from "@/components/admin/ThemeFields";
import { useFormAction } from "@/components/admin/useFormAction";
import { inputClass } from "@/components/ui";
import { type EventSettings, type OverrideKey, settingsFor } from "@/lib/events";
import { dollars, type FormState } from "@/lib/forms";

/**
 * Settings for one event date. Each setting follows the event (the template)
 * until the admin ticks "Change for this date" and sets its own value.
 */
export default function DateForm({
  action,
  date,
  template,
  when,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  date: EventDate;
  template: EventSettings;
  when: { day: string; startTime: string; endTime: string };
}) {
  const { state, onSubmit, pending } = useFormAction(action);
  // Starting values when an admin begins overriding: the date's own, or the event's.
  const current = settingsFor(date, template);
  const capLabel = (cap: number | null) => (cap == null ? "no cap" : String(cap));

  return (
    <form onSubmit={onSubmit} className="space-y-6">
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

      <Overridable
        name="theme"
        title="Theme"
        date={date}
        inherited={
          template.theme
            ? `${template.theme} (${template.themeRequired ? "songs must fit" : "optional"})`
            : "No theme"
        }
      >
        <ThemeFields theme={current.theme} required={current.themeRequired} hint="Blank for no theme on this date." />
      </Overridable>

      <Overridable name="description" title="Description" date={date} inherited={template.description ?? "No description"}>
        <Field label="Description for this date" hint="Blank for no description on this date.">
          <textarea name="description" rows={3} maxLength={2000} defaultValue={current.description ?? ""} className={inputClass} />
        </Field>
      </Overridable>

      <Overridable
        name="pricing"
        title="Prices"
        date={date}
        inherited={`Singer $${dollars(template.singerPriceCents)} · Listener $${dollars(template.listenerPriceCents)}`}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Singer price ($)">
            <input name="singerPrice" inputMode="decimal" defaultValue={dollars(current.singerPriceCents)} className={inputClass} />
          </Field>
          <Field label="Listener price ($)">
            <input name="listenerPrice" inputMode="decimal" defaultValue={dollars(current.listenerPriceCents)} className={inputClass} />
          </Field>
        </div>
      </Overridable>

      <Overridable
        name="capacity"
        title="Spots"
        date={date}
        inherited={`Singers ${capLabel(template.maxSingers)} · Listeners ${capLabel(template.maxListeners)}`}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Singer cap" hint="Blank for no cap.">
            <input name="maxSingers" inputMode="numeric" defaultValue={current.maxSingers ?? ""} className={inputClass} />
          </Field>
          <Field label="Listener cap" hint="Blank for no cap.">
            <input name="maxListeners" inputMode="numeric" defaultValue={current.maxListeners ?? ""} className={inputClass} />
          </Field>
        </div>
      </Overridable>

      <Field label="Banner image link (optional)" hint="Blank uses the event's banner, or the default singing photo.">
        <input name="bannerUrl" type="url" defaultValue={date.bannerUrl ?? ""} placeholder="https://…" className={inputClass} />
      </Field>
      <FormStatus state={state} pending={pending} label="Save this date" />
    </form>
  );
}

/** One setting: shows the event's value, or the date's own fields once "Change for this date" is ticked. */
function Overridable({
  name,
  title,
  date,
  inherited,
  children,
}: {
  name: OverrideKey;
  title: string;
  date: EventDate;
  inherited: string;
  children: React.ReactNode;
}) {
  const [custom, setCustom] = useState(date.overrides.includes(name));
  return (
    <div className="space-y-3 rounded-lg border border-line p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-royal">{title}</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="custom"
            value={name}
            checked={custom}
            onChange={(e) => setCustom(e.target.checked)}
          />
          Change for this date
        </label>
      </div>
      {custom ? (
        children
      ) : (
        <p className="whitespace-pre-line text-sm text-ink-muted">
          From the event settings: <span className="text-ink">{inherited}</span>
        </p>
      )}
    </div>
  );
}
