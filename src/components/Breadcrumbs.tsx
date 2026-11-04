import Link from "next/link";

/**
 * "Home › Group › Event" trail under the banner on group and event pages.
 * The last item is the current page and isn't a link.
 */
export default function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex min-w-0 items-center gap-1.5 text-ink-muted">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className={`flex items-center gap-1.5 ${last ? "min-w-0" : "shrink-0"}`}>
              {i > 0 && (
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0 text-line" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="m8 5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {item.href && !last ? (
                <Link href={item.href} className="font-medium hover:text-cobalt hover:underline">
                  {i === 0 ? (
                    <span className="flex items-center gap-1">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {item.label}
                    </span>
                  ) : (
                    item.label
                  )}
                </Link>
              ) : (
                <span aria-current="page" className="truncate font-medium text-ink">
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
