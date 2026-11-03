"use client";

import { useState } from "react";
import Field from "@/components/admin/Field";
import FormStatus from "@/components/admin/FormStatus";
import { useFormAction } from "@/components/admin/useFormAction";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/lib/forms";

export type SongDefaults = {
  title: string;
  artist: string;
  youtubeUrl: string;
  duet: boolean;
  duetPartnerId: string | null;
};

/** Someone signed up for the same date who can be picked as a duet partner. */
export type DuetPartnerOption = { id: string; name: string; listener: boolean };

/**
 * Song title, film or artist, YouTube track, and solo or duet for each round.
 * A duet can name a partner from `partners`. Shared by singers and admins.
 */
export function SongFields({
  rounds,
  defaults,
  partners = [],
}: {
  rounds: number[];
  defaults?: Record<number, SongDefaults | undefined>;
  partners?: DuetPartnerOption[];
}) {
  return (
    <div className="space-y-4">
      {rounds.map((r) => (
        <RoundFields key={r} round={r} defaults={defaults?.[r]} partners={partners} />
      ))}
    </div>
  );
}

function RoundFields({
  round: r,
  defaults,
  partners,
}: {
  round: number;
  defaults?: SongDefaults;
  partners: DuetPartnerOption[];
}) {
  const [duet, setDuet] = useState(!!defaults?.duet);
  return (
    <fieldset className="space-y-2 rounded-lg border border-line p-3">
      <legend className="px-1 text-sm font-semibold text-royal">Round {r}</legend>
      <Field label="Song title">
        <input
          name={`title${r}`}
          defaultValue={defaults?.title}
          maxLength={150}
          placeholder="e.g. Pehla Nasha"
          className={inputClass}
        />
      </Field>
      <Field label="Film or artist (optional)">
        <input name={`artist${r}`} defaultValue={defaults?.artist} maxLength={150} className={inputClass} />
      </Field>
      <Field label="YouTube karaoke track (optional)">
        <input
          name={`youtube${r}`}
          type="url"
          inputMode="url"
          defaultValue={defaults?.youtubeUrl}
          placeholder="https://youtu.be/…"
          className={inputClass}
        />
      </Field>
      <div role="radiogroup" aria-label={`Round ${r}: solo or duet`} className="flex gap-4 pt-1 text-sm">
        {(["solo", "duet"] as const).map((kind) => (
          <label key={kind} className="flex items-center gap-2">
            <input
              type="radio"
              name={`kind${r}`}
              value={kind}
              checked={(kind === "duet") === duet}
              onChange={() => setDuet(kind === "duet")}
              className="accent-royal"
            />
            {kind === "solo" ? "Solo" : "Duet"}
          </label>
        ))}
      </div>
      {duet && (
        <Field label="Duet partner (optional)" hint="Pick someone signed up for this date, or leave it for later.">
          <select name={`partner${r}`} defaultValue={defaults?.duetPartnerId ?? ""} className={inputClass}>
            <option value="">Not picked yet</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.listener ? " (listener)" : ""}
              </option>
            ))}
          </select>
        </Field>
      )}
    </fieldset>
  );
}

export default function SongsForm({
  action,
  defaults,
  partners,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  defaults: Record<number, SongDefaults | undefined>;
  partners: DuetPartnerOption[];
}) {
  const { state, onSubmit, pending } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <SongFields rounds={[1, 2]} defaults={defaults} partners={partners} />
      <FormStatus state={state} pending={pending} label="Save songs" />
    </form>
  );
}
