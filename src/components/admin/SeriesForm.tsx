"use client";

import { useState } from "react";
import type { EventSeries, Frequency } from "@prisma/client";
import Field from "@/components/admin/Field";
import FormStatus from "@/components/admin/FormStatus";
import ThemeFields from "@/components/admin/ThemeFields";
import { useFormAction } from "@/components/admin/useFormAction";
import { inputClass } from "@/components/ui";
import { dollars, type FormState } from "@/lib/forms";

type Action = (prev: FormState, form: FormData) => Promise<FormState>;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function ymdOf(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

/** Create or edit an event series: details, schedule, prices, caps and banner. */
export default function SeriesForm({ action, series }: { action: Action; series?: EventSeries }) {
  const { state, onSubmit, pending } = useFormAction(action);
  const [frequency, setFrequency] = useState<Frequency>(series?.frequency ?? "WEEKLY");
  const [firstDate, setFirstDate] = useState(ymdOf(series?.firstDate));
  const weekday = firstDate ? WEEKDAYS[new Date(`${firstDate}T00:00:00Z`).getUTCDay()] : "day";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="mb-2 font-semibold text-royal">Details</legend>
        <Field label="Title" hint='For example "Saturday Night Sur".'>
          <input name="title" required maxLength={120} defaultValue={series?.title} className={inputClass} />
        </Field>
        <ThemeFields
          theme={series?.theme}
          required={series?.themeRequired}
          hint="Blank for no theme. You can change it for a single date later."
        />
        <Field label="Description (optional)">
          <textarea name="description" rows={3} defaultValue={series?.description ?? ""} className={inputClass} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Venue name">
            <input name="venueName" required defaultValue={series?.venueName} className={inputClass} />
          </Field>
          <Field label="Venue address">
            <input name="venueAddress" required defaultValue={series?.venueAddress} className={inputClass} />
          </Field>
        </div>
        <Field label="Who can see it">
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="visibility" value="PUBLIC" defaultChecked={series?.visibility !== "PRIVATE"} />
              Public: listed on the home page
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="visibility" value="PRIVATE" defaultChecked={series?.visibility === "PRIVATE"} />
              Private: only people with the link
            </label>
          </div>
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-semibold text-royal">Schedule (Pacific time)</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Repeats">
            <select
              name="frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as Frequency)}
              className={inputClass}
            >
              <option value="ONCE">Does not repeat</option>
              <option value="WEEKLY">Every week</option>
              <option value="BIWEEKLY">Every 2 weeks</option>
              <option value="MONTHLY">Every month</option>
            </select>
          </Field>
          <Field label={frequency === "ONCE" ? "Date" : "First date"}>
            <input
              name="firstDate"
              type="date"
              required
              value={firstDate}
              onChange={(e) => setFirstDate(e.target.value)}
              className={inputClass}
            />
          </Field>
          {frequency === "MONTHLY" && (
            <Field label="Which week">
              <select name="monthlyWeekOfMonth" defaultValue={series?.monthlyWeekOfMonth ?? ""} className={inputClass}>
                <option value="">Same week as the first date</option>
                <option value="1">1st {weekday}</option>
                <option value="2">2nd {weekday}</option>
                <option value="3">3rd {weekday}</option>
                <option value="4">4th {weekday}</option>
                <option value="-1">Last {weekday}</option>
              </select>
            </Field>
          )}
          {frequency !== "ONCE" && (
            <Field label="Last date (optional)" hint="Blank keeps it going.">
              <input name="endDate" type="date" defaultValue={ymdOf(series?.endDate)} className={inputClass} />
            </Field>
          )}
          <Field label="Start time">
            <input name="startTime" type="time" required defaultValue={series?.startTime ?? "19:00"} className={inputClass} />
          </Field>
          <Field label="End time">
            <input name="endTime" type="time" required defaultValue={series?.endTime ?? "22:00"} className={inputClass} />
          </Field>
        </div>
        {frequency !== "ONCE" && (
          <p className="text-xs text-ink-muted">Dates are created 8 weeks ahead and topped up every day.</p>
        )}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-semibold text-royal">Prices and spots</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Singer price ($)" hint="0 for free.">
            <input
              name="singerPrice"
              inputMode="decimal"
              defaultValue={series ? dollars(series.singerPriceCents) : ""}
              placeholder="20"
              className={inputClass}
            />
          </Field>
          <Field label="Listener price ($)" hint="0 for free.">
            <input
              name="listenerPrice"
              inputMode="decimal"
              defaultValue={series ? dollars(series.listenerPriceCents) : ""}
              placeholder="10"
              className={inputClass}
            />
          </Field>
          <Field label="Singer cap (optional)" hint="Blank for no cap.">
            <input name="maxSingers" inputMode="numeric" defaultValue={series?.maxSingers ?? ""} className={inputClass} />
          </Field>
          <Field label="Listener cap (optional)" hint="Blank for no cap.">
            <input name="maxListeners" inputMode="numeric" defaultValue={series?.maxListeners ?? ""} className={inputClass} />
          </Field>
        </div>
        <Field label="Banner image link (optional)" hint="Blank uses the group's banner, or the default singing photo.">
          <input name="bannerUrl" type="url" defaultValue={series?.bannerUrl ?? ""} placeholder="https://…" className={inputClass} />
        </Field>
      </fieldset>

      <FormStatus state={state} pending={pending} label={series ? "Save event" : "Create event"} />
    </form>
  );
}
