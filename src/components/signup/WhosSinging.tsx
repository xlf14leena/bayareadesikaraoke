import { ROUND_KIND_LABEL, type RoundConfig } from "@/lib/rounds";

export type LineupSong = {
  title: string;
  artist: string | null;
  youtubeUrl: string | null;
  duet: boolean;
  /** The partner's name, or null for a duet whose partner no longer holds a spot. */
  duetWith: string | null;
};
export type LineupRound = { round: number; config: RoundConfig | null };
export type LineupSinger = { id: string; name: string; songs: Map<number, LineupSong> };
export type LineupWaiting = { id: string; name: string; role: "SINGER" | "LISTENER"; place: number };
export type LineupListener = { id: string; name: string };

type Props = {
  rounds: LineupRound[];
  singers: LineupSinger[];
  waitlisted: LineupWaiting[];
  listeners: LineupListener[];
};

/**
 * The event page's "Who's singing" table: confirmed singers in payment order
 * with a column per round, then the waitlist and confirmed listeners. On a
 * phone each row stacks, with the round as a label beside each song.
 */
export default function WhosSinging({ rounds, singers, waitlisted, listeners }: Props) {
  const showRoundNames = rounds.length > 1;
  const cols = 2 + rounds.length;
  return (
    <table className="w-full border-collapse text-left">
      <thead className="max-sm:hidden">
        <tr className="border-b-2 border-line align-bottom">
          <th scope="col" className="w-10 py-2 pl-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            #
          </th>
          <th scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Name
          </th>
          {rounds.map(({ round, config }) => (
            <th key={round} scope="col" className="px-3 py-2">
              {showRoundNames ? <RoundName round={round} config={config} /> : (
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Song</span>
              )}
            </th>
          ))}
        </tr>
      </thead>

      {singers.length > 0 && (
        <tbody>
          <GroupRow cols={cols} label="Singing" count={singers.length} note="in payment order" first />
          {singers.map((s, i) => (
            <tr key={s.id} className="border-b border-line max-sm:grid max-sm:grid-cols-[2rem_1fr] max-sm:gap-y-1 max-sm:py-2.5">
              <Place n={i + 1} />
              <td className="font-medium sm:px-3 sm:py-2.5">{s.name}</td>
              {rounds.map(({ round }) => (
                <td
                  key={round}
                  className="align-top max-sm:col-start-2 max-sm:grid max-sm:grid-cols-[4.5rem_1fr] max-sm:items-baseline sm:px-3 sm:py-2.5"
                >
                  {showRoundNames && (
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted sm:hidden">Round {round}</span>
                  )}
                  <span>
                    <Song song={s.songs.get(round)} />
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      )}

      {waitlisted.length > 0 && (
        <tbody>
          <GroupRow cols={cols} label="Waitlisted" count={waitlisted.length} note="in waitlist order" first={singers.length === 0} />
          {waitlisted.map((w) => (
            <tr key={w.id} className="border-b border-line max-sm:grid max-sm:grid-cols-[2rem_1fr_auto] max-sm:items-baseline max-sm:py-2.5">
              <Place n={w.place} />
              <td className="sm:px-3 sm:py-2.5">{w.name}</td>
              <td colSpan={rounds.length} className="text-sm text-ink-muted sm:px-3 sm:py-2.5">
                {w.role === "SINGER" ? "Singer" : "Listener"}
              </td>
            </tr>
          ))}
        </tbody>
      )}

      {listeners.length > 0 && (
        <tbody>
          <GroupRow
            cols={cols}
            label="Listening"
            count={listeners.length}
            first={singers.length === 0 && waitlisted.length === 0}
          />
          {listeners.map((l, i) => (
            <tr key={l.id} className="border-b border-line max-sm:grid max-sm:grid-cols-[2rem_1fr] max-sm:py-2.5">
              <Place n={i + 1} />
              <td colSpan={cols - 1} className="sm:px-3 sm:py-2.5">
                {l.name}
              </td>
            </tr>
          ))}
        </tbody>
      )}
    </table>
  );
}

function RoundName({ round, config }: { round: number; config: RoundConfig | null }) {
  return (
    <span className="font-semibold text-royal">
      Round {round}
      {config && config.kind !== "EITHER" && (
        <span className="ml-2 text-sm font-normal text-ink-muted">{ROUND_KIND_LABEL[config.kind]}</span>
      )}
      {config?.theme && <span className="ml-2 text-sm font-normal text-lapis">· {config.theme}</span>}
    </span>
  );
}

function GroupRow({ cols, label, count, note, first }: { cols: number; label: string; count: number; note?: string; first?: boolean }) {
  return (
    <tr className="border-b border-line max-sm:block">
      <th
        scope="colgroup"
        colSpan={cols}
        className={`px-1 pb-1.5 font-normal max-sm:block ${first ? "pt-3 max-sm:pt-0" : "pt-5"}`}
      >
        <span className="text-[13px] font-semibold uppercase tracking-wider text-royal">{label}</span>
        <span className="ml-2 inline-block rounded-full bg-mist px-2 text-xs font-semibold leading-[18px] text-royal">{count}</span>
        {note && <span className="ml-2.5 text-[13px] text-ink-muted">{note}</span>}
      </th>
    </tr>
  );
}

function Place({ n }: { n: number }) {
  return <td className="w-10 pl-1 align-top tabular-nums text-ink-muted sm:py-2.5">{n}</td>;
}

function Song({ song }: { song: LineupSong | undefined }) {
  if (!song) return <span className="italic text-ink-muted">Not picked yet</span>;
  const extra = [
    song.artist,
    song.duet ? (song.duetWith ? `duet with ${song.duetWith}` : "duet") : null,
  ].filter(Boolean);
  return (
    <>
      {song.youtubeUrl ? (
        <a
          href={song.youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-cobalt hover:underline"
          title="Open the track"
        >
          {song.title}
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ml-1 inline-block h-3.5 w-3.5 align-[-1px] opacity-70"
          >
            <path d="M11 3h6v6M17 3l-8 8M15 12v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4" />
          </svg>
          <span className="sr-only"> (opens the track)</span>
        </a>
      ) : (
        <span className="font-medium">{song.title}</span>
      )}
      {extra.length > 0 && <span className="text-sm text-ink-muted"> · {extra.join(" · ")}</span>}
    </>
  );
}
