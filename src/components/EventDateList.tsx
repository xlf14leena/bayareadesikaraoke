import Link from "next/link";
import type { EventDate, EventSeries, Group } from "@prisma/client";
import GroupThumb from "@/components/GroupThumb";
import { eventPath } from "@/lib/event-url";
import { settingsFor } from "@/lib/events";
import { groupThumbnails } from "@/lib/group-thumbnails";
import { roundThemes, roundsFor } from "@/lib/rounds";
import { formatDateBadge, formatEventDate, formatEventTime, formatPrice } from "@/lib/format";

export type ListedDate = EventDate & { series: EventSeries & { group: Group } };

/**
 * Cards for event dates; each opens the event page, and the thumbnail opens the group's page. `privateKey` is added to links for private events.
 * `past` drops what only matters before the night (the sign-ups badge and prices).
 */
export default async function EventDateList({
  dates,
  privateKey,
  past = false,
}: {
  dates: ListedDate[];
  privateKey?: string;
  past?: boolean;
}) {
  const thumbs = await groupThumbnails(dates.map((d) => d.series.group));
  return (
    <ul className="space-y-3">
      {dates.map((d) => {
        const thumb = thumbs.get(d.series.group.id)!;
        const badge = formatDateBadge(d.startsAt);
        const settings = settingsFor(d, d.series);
        const themes = roundThemes(roundsFor(d, d.series));
        return (
          <li
            key={d.id}
            className="relative flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-white p-3 transition hover:border-lapis hover:shadow-sm has-[a:focus-visible]:border-lapis sm:flex-nowrap sm:p-4"
          >
            <div
              className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl text-center ${past ? "bg-mist text-ink-muted" : "bg-gold text-gold-ink"}`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider">{badge.month}</p>
              <p className="font-display text-3xl leading-none">{badge.day}</p>
            </div>
            {/* The group's square thumbnail (src/lib/group-thumbnail.ts). It opens the group's page; it
                sits above the card-wide event link so the two links don't nest. */}
            <Link
              href={`/g/${d.series.group.slug}`}
              aria-label={`${d.series.group.name} group page`}
              title={d.series.group.name}
              className="relative z-10 hidden shrink-0 overflow-hidden rounded-xl bg-mist ring-lapis transition hover:ring-2 sm:block"
            >
              <GroupThumb thumb={thumb} />
            </Link>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold leading-snug">
                {/* The card's main link: its ::after covers the whole card, so a tap anywhere else opens the event. */}
                <Link
                  href={eventPath(d, privateKey)}
                  className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
                >
                  {d.series.title}
                </Link>
              </h3>
              <p className="text-sm text-ink-muted">
                {d.series.group.name} · {formatEventDate(d.startsAt)}, {formatEventTime(d.startsAt, d.endsAt)}
              </p>
              {themes.length > 0 && (
                <p className="truncate text-sm text-lapis" title={themes.join(" · ")}>
                  {themes.length === 1 ? "Theme" : "Themes"}: {themes.join(" · ")}
                </p>
              )}
              <p className="text-sm text-ink-muted">
                {d.series.venueName}
                {d.signupsOpen && !past && (
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    Sign-ups open
                  </span>
                )}
              </p>
            </div>
            {!past && (
            <p className="w-full pl-20 text-sm text-ink-muted sm:w-auto sm:pl-0 sm:text-right sm:whitespace-nowrap">
              Singer <span className="font-semibold text-ink">{formatPrice(settings.singerPriceCents)}</span>
              {" · "}
              Listener <span className="font-semibold text-ink">{formatPrice(settings.listenerPriceCents)}</span>
            </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
