"use client";

import { useEffect, useRef, useState } from "react";
import type { DuetStatus } from "@prisma/client";
import Field from "@/components/admin/Field";
import FormStatus from "@/components/admin/FormStatus";
import { useFormAction } from "@/components/admin/useFormAction";
import { inputClass, selectClass } from "@/components/ui";
import TrackLength from "@/components/TrackLength";
import { LONG_TRACK_SECONDS } from "@/lib/format";
import type { FormState, NearMatch } from "@/lib/forms";
import { ROUND_KIND_LABEL, type RoundAppearances, type RoundConfig, type RoundKind, timesLabel } from "@/lib/rounds";

export type SongDefaults = {
  title: string;
  artist: string;
  youtubeUrl: string;
  /** The saved track's length from YouTube, when known. */
  durationSeconds?: number | null;
  duet: boolean;
  duetPartnerId: string | null;
  /** The partner's answer: PENDING, ACCEPTED or DECLINED. */
  duetStatus?: DuetStatus | null;
};

/** Another singer signed up for the same date, who can be picked as a duet partner. */
export type DuetPartnerOption = { id: string; name: string };

/**
 * Song title, film or artist, YouTube track, and solo or duet for each round
 * of the event (a solos-only or duets-only round doesn't ask).
 * A duet can name a partner from `partners`, who then accepts or declines. Shared by singers and admins.
 * When the last save found a close title (`nearMatch`), that round offers
 * "It's a different song".
 * In a round with a "times per singer" limit, `appearances` (without this
 * person's own songs) marks partners who already sing that many times, and
 * when `selfId` is one of them the round has no song fields.
 */
export function SongFields({
  rounds,
  defaults,
  partners = [],
  nearMatch,
  appearances,
  selfId,
}: {
  rounds: RoundConfig[];
  defaults?: Record<number, SongDefaults | undefined>;
  partners?: DuetPartnerOption[];
  nearMatch?: NearMatch;
  appearances?: RoundAppearances[];
  selfId?: string;
}) {
  return (
    <div className="space-y-5">
      {rounds.map(({ kind, theme, themeRequired, maxAppearances }, i) => (
        <RoundFields
          key={i + 1}
          round={i + 1}
          kind={kind}
          theme={theme}
          themeRequired={themeRequired}
          maxAppearances={maxAppearances}
          appearances={appearances?.[i] ?? {}}
          selfId={selfId}
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
  theme,
  themeRequired,
  maxAppearances,
  appearances,
  selfId,
  defaults,
  partners,
  nearMatchKey,
}: {
  round: number;
  kind: RoundKind;
  theme: string | null;
  themeRequired: boolean;
  maxAppearances: number | null;
  appearances: RoundAppearances;
  selfId?: string;
  defaults?: SongDefaults;
  partners: DuetPartnerOption[];
  nearMatchKey?: string;
}) {
  const [chosenDuet, setDuet] = useState(!!defaults?.duet);
  const duet = roundKind === "EITHER" ? chosenDuet : roundKind === "DUET";
  const full = (id: string) => maxAppearances != null && (appearances[id] ?? 0) >= maxAppearances;
  // Already singing the most allowed as someone's duet partner, with no song of their own here to keep.
  const selfFull = !!selfId && !defaults?.title && full(selfId);
  return (
    <fieldset className="overflow-hidden rounded-lg border border-line">
      {/* A filled header band so each round reads as its own block. */}
      <legend className="sr-only">Round {r}: {ROUND_KIND_LABEL[roundKind]}</legend>
      <div aria-hidden className="flex items-center gap-2 bg-royal px-3 py-1.5 text-sm font-semibold text-white">
        <span className="grid size-5 place-items-center rounded-full bg-white text-xs text-royal">{r}</span>
        Round {r}
        <span className="ml-auto rounded-full bg-gold px-2 py-0.5 text-xs font-semibold text-royal">{ROUND_KIND_LABEL[roundKind]}</span>
      </div>
      {maxAppearances != null && (
        <p className="border-b border-line bg-white px-3 py-1.5 text-xs text-ink-muted">
          Each singer sings at most {timesLabel(maxAppearances)} this round, counting duets they&apos;re picked for.
        </p>
      )}
      {theme ? (
        <p className="border-b border-gold/40 bg-gold/15 px-3 py-1.5 text-sm text-gold-ink">
          <span className="font-semibold">Theme: {theme}</span>
          <span className="text-gold-ink/70">
            {" "}
            · {themeRequired ? "your song must fit it" : "just a suggestion"}
          </span>
        </p>
      ) : (
        <p className="border-b border-gold/40 bg-gold/15 px-3 py-1.5 text-sm text-gold-ink">No theme: sing anything you like</p>
      )}
      {selfFull ? (
        <p className="bg-mist/60 p-3 text-sm">
          You&apos;re already singing {timesLabel(appearances[selfId!] ?? 0)} this round as a duet partner, the most
          allowed, so you can&apos;t add your own song here.
        </p>
      ) : (
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
            <TrackInput round={r} defaultUrl={defaults?.youtubeUrl ?? ""} defaultSeconds={defaults?.durationSeconds ?? null} />
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
                  {partners.map((p) => {
                    // A partner already saved on this song stays pickable even if the limit was lowered since.
                    const taken = full(p.id) && p.id !== defaults?.duetPartnerId;
                    return (
                      <option key={p.id} value={p.id} disabled={taken}>
                        {p.name}
                        {taken && ` (already singing ${timesLabel(appearances[p.id] ?? 0)})`}
                      </option>
                    );
                  })}
                </select>
              </label>
            )}
            {duet && defaults?.duetPartnerId && defaults.duetStatus && defaults.duetStatus !== "ACCEPTED" && (
              <p className={`w-full text-xs ${defaults.duetStatus === "DECLINED" ? "text-red-700" : "text-ink-muted"}`}>
                {defaults.duetStatus === "DECLINED"
                  ? `${partners.find((p) => p.id === defaults.duetPartnerId)?.name ?? "Your partner"} declined. Pick someone else.`
                  : `Waiting for ${partners.find((p) => p.id === defaults.duetPartnerId)?.name ?? "your partner"} to accept.`}
              </p>
            )}
          </div>
        </div>
      )}
    </fieldset>
  );
}

/**
 * The YouTube link field, with the track's length under it so the singer can check it's the right
 * one. The saved link shows its stored length; a new link is looked up (/api/youtube/length) once
 * the singer stops typing. Nothing shows when the length isn't known.
 */
function TrackInput({ round, defaultUrl, defaultSeconds }: { round: number; defaultUrl: string; defaultSeconds: number | null }) {
  const [url, setUrl] = useState(defaultUrl);
  const input = useRef<HTMLInputElement>(null);
  // Left uncontrolled so a form reset (the admin's add-person form) clears it; follow the reset too.
  useEffect(() => {
    const form = input.current?.form;
    const onReset = () => setUrl(defaultUrl);
    form?.addEventListener("reset", onReset);
    return () => form?.removeEventListener("reset", onReset);
  }, [defaultUrl]);
  const [looked, setLooked] = useState<{ url: string; seconds: number | null } | null>(null);
  const trimmed = url.trim();
  const isSaved = trimmed === defaultUrl.trim();
  useEffect(() => {
    if (isSaved || !/youtu\.?be/i.test(trimmed)) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/youtube/length?url=${encodeURIComponent(trimmed)}`, { signal: ctrl.signal });
        if (res.ok) setLooked({ url: trimmed, seconds: (await res.json()).seconds ?? null });
      } catch {
        // No preview; the length is looked up again when the song is saved.
      }
    }, 600);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [trimmed, isSaved]);
  const seconds = isSaved ? defaultSeconds : looked?.url === trimmed ? looked.seconds : null;
  return (
    <>
      <input
        name={`youtube${round}`}
        type="url"
        inputMode="url"
        ref={input}
        defaultValue={defaultUrl}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://youtu.be/…"
        className={inputClass}
      />
      {seconds != null && (
        <span className="mt-1 block text-xs text-ink-muted">
          Track length <TrackLength seconds={seconds} className="font-medium text-ink" />
          {seconds > LONG_TRACK_SECONDS && <span className="text-red-700"> · longer than 6 minutes</span>}
        </span>
      )}
    </>
  );
}

export default function SongsForm({
  action,
  rounds,
  defaults,
  partners,
  appearances,
  selfId,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  rounds: RoundConfig[];
  defaults: Record<number, SongDefaults | undefined>;
  partners: DuetPartnerOption[];
  appearances?: RoundAppearances[];
  selfId?: string;
}) {
  const { state, onSubmit, pending } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <SongFields
        rounds={rounds}
        defaults={defaults}
        partners={partners}
        nearMatch={state?.nearMatch}
        appearances={appearances}
        selfId={selfId}
      />
      <FormStatus state={state} pending={pending} label="Save songs" />
    </form>
  );
}
