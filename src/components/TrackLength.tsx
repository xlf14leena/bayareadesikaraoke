import { LONG_TRACK_SECONDS, formatDuration } from "@/lib/format";

/** A track's length, e.g. "4:12". Over 6 minutes it shows in red, with the reason on hover and for screen readers. */
export default function TrackLength({ seconds, className = "" }: { seconds: number; className?: string }) {
  const long = seconds > LONG_TRACK_SECONDS;
  return (
    <span
      className={`tabular-nums ${long ? "font-semibold text-red-700" : ""} ${className}`}
      title={long ? "Longer than 6 minutes" : undefined}
    >
      {formatDuration(seconds)}
      {long && <span className="sr-only"> (longer than 6 minutes)</span>}
    </span>
  );
}
