"use client";

import { useState } from "react";
import Field from "@/components/admin/Field";
import FormStatus from "@/components/admin/FormStatus";
import { useFormAction } from "@/components/admin/useFormAction";
import { inputClass, selectClass } from "@/components/ui";
import type { FormState, NearMatch } from "@/lib/forms";
import type { RoundConfig, RoundKind } from "@/lib/rounds";

export type SongDefaults = {
  title: string;
  artist: string;
  youtubeUrl: string;
  duet: boolean;
  duetPartnerId: string | null;
};

/** Another singer signed up for the same date, who can be picked as a duet partner. */
export type DuetPartnerOption = { id: string; name: string };

/**
 * Song title, film or artist, YouTube track, and solo or duet for each round
 * of the event (a solos-only or duets-only round doesn't ask).
 * A duet can name a partner from `partners`. Shared by singers and admins.
 * When the last save found a close title (`nearMatch`), that round offers
 * "It's a different song".
 */
export function SongFields({
  rounds,
  defaults,
  partners = [],
  nearMatch,
}: {
  rounds: RoundConfig[];
  defaults?: Record<number, SongDefaults | undefined>;
  partners?: DuetPartnerOption[];
  nearMatch?: NearMatch;
}) {
  return (
    <div className="space-y-5">
      {rounds.map(({ kind }, i) => (
        <RoundFields
          key={i + 1}
          round={i + 1}
          kind={kind}
          defaults={defaults?.[i + 1]}
          partners={partners}
          nearMatchKey={nearMatch?.round === i + 1 ? nearMatch.key : undefined}
        />
      ))}
    </div>
  );
}

function RoundFields({
  round: r,
  kind: roundKind,
  defaults,
  partners,
  nearMatchKey,
}: {
  round: number;
  kind: RoundKind;
  defaults?: SongDefaults;
  partners: DuetPartnerOption[];
  nearMatchKey?: string;
}) {
  const [chosenDuet, setDuet] = useState(!!defaults?.duet);
  const duet = roundKind === "EITHER" ? chosenDuet : roundKind === "DUET";
  return (
    <fieldset className="overflow-hidden rounded-lg border border-line">
      {/* A filled header band so each round reads as its own block. */}
      <legend className="sr-only">Round {r}</legend>
      <div aria-hidden className="flex items-center gap-2 bg-royal px-3 py-1.5 text-sm font-semibold text-white">
        <span className="grid size-5 place-items-center rounded-full bg-white text-xs text-royal">{r}</span>
        Round {r}
        {roundKind !== "EITHER" && (
          <span className="ml-auto text-xs font-medium text-white/80">{roundKind === "SOLO" ? "Solos" : "Duets"}</span>
        )}
      </div>
      <div className="grid gap-3 bg-mist/60 p-3 sm:grid-cols-2">
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
        {nearMatchKey && (
          // Keyed so a new near match starts unticked. The value ties the tick to the title it was for.
          <label key={nearMatchKey} className="flex items-center gap-2 rounded bg-gold/30 px-2 py-1 text-sm sm:col-span-2">
            <input type="checkbox" name={`different${r}`} value={nearMatchKey} className="accent-royal" />
            It&apos;s a different song
          </label>
        )}
        <Field label="YouTube karaoke track (optional)" className="sm:col-span-2">
          <input
            name={`youtube${r}`}
            type="url"
            inputMode="url"
            defaultValue={defaults?.youtubeUrl}
            placeholder="https://youtu.be/…"
            className={inputClass}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:col-span-2">
          {roundKind === "EITHER" ? (
            <div role="radiogroup" aria-label={`Round ${r}: solo or duet`} className="flex items-center gap-4">
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
          ) : (
            <span className="text-ink-muted">{roundKind === "SOLO" ? "This round is solos." : "This round is duets."}</span>
          )}
          {duet && (
            <label className="flex min-w-[14rem] flex-1 items-center gap-2">
              <span className="shrink-0 text-ink-muted">with</span>
              <select
                name={`partner${r}`}
                defaultValue={defaults?.duetPartnerId ?? ""}
                aria-label={`Round ${r} duet partner`}
                className={selectClass}
              >
                <option value="">Not picked yet</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
    </fieldset>
  );
}

export default function SongsForm({
  action,
  rounds,
  defaults,
  partners,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  rounds: RoundConfig[];
  defaults: Record<number, SongDefaults | undefined>;
  partners: DuetPartnerOption[];
}) {
  const { state, onSubmit, pending } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <SongFields rounds={rounds} defaults={defaults} partners={partners} nearMatch={state?.nearMatch} />
      <FormStatus state={state} pending={pending} label="Save songs" />
    </form>
  );
}
