"use client";

import { useState } from "react";
import type { EventDate } from "@prisma/client";
import BannerField from "@/components/admin/BannerField";
import Field from "@/components/admin/Field";
import FormSection from "@/components/admin/FormSection";
import FormStatus from "@/components/admin/FormStatus";
import { useFormAction } from "@/components/admin/useFormAction";
import { inputClass } from "@/components/ui";
import { type EventSettings, type OverrideKey, settingsFor } from "@/lib/events";
import RoundsFields from "@/components/admin/RoundsFields";
import { dollars, type FormState } from "@/lib/forms";
import { type RoundConfig, describeRounds } from "@/lib/rounds";
import { type ZelleDetails, zelleFor } from "@/lib/events";

/**
 * Settings for one event date. Each setting follows the event (the template)
 * until the admin ticks "Change for this date" and sets its own value.
 */
export default function DateForm({
  action,
  date,
  template,
  rounds,
  templateRounds,
  templateBanner,
  templateZelle,
  when,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  date: EventDate;
  template: EventSettings;
  /** The rounds this date uses now, and the event's. */
  rounds: RoundConfig[];
  templateRounds: RoundConfig[];
  /** The banner dates get from the event (or the group, or the default photo). */
  templateBanner: { src: string; isDefault: boolean };
  /** The Zelle details dates get from the event. */
  templateZelle: ZelleDetails;
  when: { day: string; startTime: string; endTime: string };
}) {
  const { state, onSubmit, pending } = useFormAction(action);
  // Starting values when an admin begins overriding: the date's own, or the event's.
  const current = settingsFor(date, template);
  const zelle = zelleFor(date, { zelleName: templateZelle.name, zelleHandle: templateZelle.handle });
  const capLabel = (cap: number | null) => (cap == null ? "no cap" : String(cap));

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormSection title="When" note="Pacific time">
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
      </FormSection>

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

      <Overridable
        name="rounds"
        title="Rounds"
        date={date}
        inherited={`${templateRounds.length} ${templateRounds.length === 1 ? "round" : "rounds"}\n${describeRounds(templateRounds)}`}
      >
        <RoundsFields initial={rounds} />
      </Overridable>

      <Overridable
        name="zelle"
        title="Zelle details"
        date={date}
        inherited={
          templateZelle.handle
            ? [templateZelle.name, templateZelle.handle].filter(Boolean).join(" · ")
            : "None yet, so members are asked to contact the organizers"
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Zelle recipient name">
            <input name="zelleName" maxLength={100} defaultValue={zelle.name ?? ""} className={inputClass} />
          </Field>
          <Field label="Zelle email or phone">
            <input name="zelleHandle" maxLength={100} defaultValue={zelle.handle ?? ""} className={inputClass} />
          </Field>
        </div>
      </Overridable>

      <Overridable
        name="banner"
        title="Banner"
        date={date}
        inherited={
          // eslint-disable-next-line @next/next/no-img-element
          <img src={templateBanner.src} alt="" className="mt-1 h-auto max-h-64 w-full max-w-md rounded-lg border border-line bg-mist object-contain" />
        }
        inheritedNote={templateBanner.isDefault ? "The default singing photo" : undefined}
      >
        <BannerField current={date.bannerUrl} hint="Used for this date only." />
      </Overridable>

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
  inheritedNote,
  children,
}: {
  name: OverrideKey;
  title: string;
  date: EventDate;
  inherited: React.ReactNode;
  inheritedNote?: string;
  children: React.ReactNode;
}) {
  const [custom, setCustom] = useState(date.overrides.includes(name));
  return (
    <FormSection
      title={title}
      action={
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
      }
    >
      {custom ? (
        children
      ) : typeof inherited === "string" ? (
        <p className="whitespace-pre-line text-sm text-ink-muted">
          From the event template: <span className="text-ink">{inherited}</span>
        </p>
      ) : (
        <div className="text-sm text-ink-muted">
          From the event template{inheritedNote ? <>: <span className="text-ink">{inheritedNote}</span></> : null}
          {inherited}
        </div>
      )}
    </FormSection>
  );
}
