import { HOLDS_SPOT } from "@/lib/events";
import type { SignUpStatus } from "@prisma/client";

export type PublicOrderRow = {
  round: number;
  slot: number;
  signUpId: string;
  name: string;
  song: {
    title: string;
    artist: string | null;
    youtubeUrl: string | null;
    duet: boolean;
    duetPartner: { displayName: string; status: SignUpStatus } | null;
  } | null;
};

/** The event page's running order: each round by slot, with a link to every singer's track. */
export default function PublicRunningOrder({
  rows,
  mySignUpId,
  now,
}: {
  rows: PublicOrderRow[];
  mySignUpId: string | null;
  now: { round: number; slot: number } | null;
}) {
  const rounds = [1, 2].map((r) => rows.filter((row) => row.round === r)).filter((list) => list.length > 0);
  const isNow = (row: PublicOrderRow) => now?.round === row.round && now.slot === row.slot;
  const current = rows.find(isNow);
  const openRound = now?.round ?? rounds[0]?.[0].round;
  // How many singers before the viewer's next turn in the round being sung.
  const myNext = now ? rows.find((r) => r.signUpId === mySignUpId && r.round === now.round && r.slot > now.slot) : null;
  const before = myNext ? rows.filter((r) => r.round === now!.round && r.slot > now!.slot && r.slot < myNext.slot).length : 0;
  return (
    <section id="running-order" className="rounded-xl border border-line bg-white p-4 sm:p-6">
      <h2 className="mb-1 text-xl font-semibold">Running order</h2>
      <p className="mb-4 text-sm text-ink-muted">Singers get a slot after they check in at the venue.</p>
      {now && (
        <div className="mb-4 rounded-lg border border-gold bg-gold/20 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold-ink">Now singing</p>
          <p className="text-lg font-semibold text-royal">
            Round {now.round} · #{now.slot}
            {current && <span className="font-medium text-ink"> · {current.name}</span>}
          </p>
          {current?.song && <p className="text-sm text-ink-muted">{current.song.title}</p>}
          {myNext && (
            <p className="mt-1 text-sm font-medium text-ink">
              {before === 0 ? "You're up next!" : `You're up after ${before} more ${before === 1 ? "singer" : "singers"}.`}
            </p>
          )}
        </div>
      )}
      <div className="space-y-3">
        {rounds.map((list) => (
          // One round sings at a time, so only the round being sung (or the first) is open.
          <details key={list[0].round} open={list[0].round === openRound} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg bg-mist px-3 py-2 font-semibold text-royal [&::-webkit-details-marker]:hidden">
              <span>
                Round {list[0].round}{" "}
                <span className="text-sm font-normal text-ink-muted">
                  · {list.length} {list.length === 1 ? "singer" : "singers"}
                </span>
              </span>
              <span aria-hidden className="text-ink-muted transition-transform group-open:rotate-180">
                ▾
              </span>
            </summary>
            <ol className="mt-2 divide-y divide-line rounded-lg border border-line">
              {list.map((row) => {
                const mine = row.signUpId === mySignUpId;
                const { song } = row;
                return (
                  <li
                    key={row.slot}
                    className={`flex items-center gap-3 px-3 py-2 ${
                      isNow(row) ? "bg-royal/10" : mine ? "bg-gold/20" : ""
                    }`}
                  >
                    <span className="w-7 shrink-0 text-right font-semibold text-royal">{row.slot}</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">
                        {row.name}
                        {mine && <span className="ml-1 text-xs font-normal text-ink-muted">(you)</span>}
                        {isNow(row) && (
                          <span className="ml-2 rounded-full bg-royal px-2 py-0.5 text-xs font-semibold text-white">Now</span>
                        )}
                      </span>
                      <span className="block truncate text-sm text-ink-muted">
                        {song ? (
                          <>
                            {song.title}
                            {song.artist && ` (${song.artist})`}
                            {song.duet &&
                              (song.duetPartner && HOLDS_SPOT.includes(song.duetPartner.status)
                                ? ` · duet with ${song.duetPartner.displayName}`
                                : " · duet")}
                          </>
                        ) : (
                          "Song not picked yet"
                        )}
                      </span>
                    </span>
                    {song?.youtubeUrl && (
                      <a
                        href={song.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Play the track for ${song.title}`}
                        className="shrink-0 rounded-full border border-line px-3 py-1 text-sm font-medium text-cobalt hover:border-lapis"
                      >
                        ▶ Track
                      </a>
                    )}
                  </li>
                );
              })}
            </ol>
          </details>
        ))}
      </div>
    </section>
  );
}
