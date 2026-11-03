"use client";

import Field from "@/components/admin/Field";
import FormStatus from "@/components/admin/FormStatus";
import { useFormAction } from "@/components/admin/useFormAction";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/lib/forms";

export type SongDefaults = { title: string; artist: string; youtubeUrl: string; duet: boolean };

/** Song title, film or artist, YouTube track, and solo or duet for each round. Shared by singers and admins. */
export function SongFields({ rounds, defaults }: { rounds: number[]; defaults?: Record<number, SongDefaults | undefined> }) {
  return (
    <div className="space-y-4">
      {rounds.map((r) => (
        <fieldset key={r} className="space-y-2 rounded-lg border border-line p-3">
          <legend className="px-1 text-sm font-semibold text-royal">Round {r}</legend>
          <Field label="Song title">
            <input
              name={`title${r}`}
              defaultValue={defaults?.[r]?.title}
              maxLength={150}
              placeholder="e.g. Pehla Nasha"
              className={inputClass}
            />
          </Field>
          <Field label="Film or artist (optional)">
            <input name={`artist${r}`} defaultValue={defaults?.[r]?.artist} maxLength={150} className={inputClass} />
          </Field>
          <Field label="YouTube karaoke track (optional)">
            <input
              name={`youtube${r}`}
              type="url"
              inputMode="url"
              defaultValue={defaults?.[r]?.youtubeUrl}
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
                  defaultChecked={(kind === "duet") === !!defaults?.[r]?.duet}
                  className="accent-royal"
                />
                {kind === "solo" ? "Solo" : "Duet"}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export default function SongsForm({
  action,
  defaults,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  defaults: Record<number, SongDefaults | undefined>;
}) {
  const { state, onSubmit, pending } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <SongFields rounds={[1, 2]} defaults={defaults} />
      <FormStatus state={state} pending={pending} label="Save songs" />
    </form>
  );
}
