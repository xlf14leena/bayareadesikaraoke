import Link from "next/link";
import type { EventDate, EventSeries, Group } from "@prisma/client";
import { formatDateBadge, formatEventDate, formatEventTime, formatPrice } from "@/lib/format";

export type ListedDate = EventDate & { series: EventSeries & { group: Group } };

/** Cards for upcoming event dates; each opens the event page. `query` is added to links (private keys). */
export default function EventDateList({ dates, query = "" }: { dates: ListedDate[]; query?: string }) {
  return (
    <ul className="space-y-3">
      {dates.map((d) => {
        const banner = d.bannerUrl ?? d.series.bannerUrl ?? d.series.group.bannerUrl;
        const badge = formatDateBadge(d.startsAt);
        return (
          <li key={d.id}>
            <Link
              href={`/e/${d.id}${query}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-white p-3 transition hover:border-lapis hover:shadow-sm sm:flex-nowrap sm:p-4"
            >
              <div className="w-16 shrink-0 rounded-xl bg-gold py-1.5 text-center text-gold-ink">
                <p className="text-[11px] font-semibold uppercase tracking-wider">{badge.month}</p>
                <p className="font-display text-3xl leading-none">{badge.day}</p>
              </div>
              {banner && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={banner} alt="" className="hidden h-16 w-24 shrink-0 rounded-lg object-cover sm:block" />
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold leading-snug">
                  {d.series.title}
                  {d.theme && <span className="text-lapis"> · {d.theme}</span>}
                </h3>
                <p className="text-sm text-ink-muted">
                  {d.series.group.name} · {formatEventDate(d.startsAt)}, {formatEventTime(d.startsAt, d.endsAt)}
                </p>
                <p className="text-sm text-ink-muted">{d.series.venueName}</p>
              </div>
              <p className="w-full pl-20 text-sm text-ink-muted sm:w-auto sm:pl-0 sm:text-right sm:whitespace-nowrap">
                Singer <span className="font-semibold text-ink">{formatPrice(d.singerPriceCents)}</span>
                {" · "}
                Listener <span className="font-semibold text-ink">{formatPrice(d.listenerPriceCents)}</span>
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
