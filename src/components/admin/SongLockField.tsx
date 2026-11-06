import type { SongLock } from "@prisma/client";
import { SONG_LOCKS, SONG_LOCK_LABEL } from "@/lib/events";

/** What each choice means for singers, under its label. */
export const SONG_LOCK_HINT: Record<SongLock, string> = {
  ROUND_START:
    "Singers can change a round's song or duet partner until you start that round. Later rounds stay open during the event.",
  CHECK_IN: "Every round locks when you open check-in, or at the start time if you don't.",
  EVENT_START: "Every round locks at the start time.",
};

/** The "song changes lock" choice, for the event template and a date's own setting. */
export default function SongLockField({ defaultValue }: { defaultValue: SongLock }) {
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">When song changes lock</legend>
      {SONG_LOCKS.map((lock) => (
        <label key={lock} className="flex items-start gap-2 text-sm">
          <input type="radio" name="songLock" value={lock} defaultChecked={lock === defaultValue} className="mt-1 accent-royal" />
          <span>
            <span className="font-medium">{SONG_LOCK_LABEL[lock]}</span>
            {lock === "ROUND_START" && <span className="text-ink-muted"> (default)</span>}
            <span className="block text-ink-muted">{SONG_LOCK_HINT[lock]}</span>
          </span>
        </label>
      ))}
      <p className="text-xs text-ink-muted">Duet partners can accept or back out until the same point. Admins can always reject a song.</p>
    </fieldset>
  );
}
