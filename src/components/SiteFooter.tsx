import Link from "next/link";

type FooterLink = { label: string; href: string };
type FooterColumn = { heading: string; links: FooterLink[] };

/**
 * To add to the footer, add a link to a column below, or a new column.
 * Columns sit side by side on wide screens and wrap on phones.
 */
const COLUMNS: FooterColumn[] = [
  {
    heading: "Karaoke nights",
    links: [
      { label: "Upcoming nights", href: "/" },
      { label: "My events", href: "/me" },
    ],
  },
];

// Small print in the bottom row, next to the copyright.
const LEGAL_LINKS: FooterLink[] = [{ label: "Privacy policy", href: "/privacy" }];

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-10 bg-royal text-white">
      <div className="toran" aria-hidden="true" />
      <div className="mx-auto max-w-5xl px-4 pb-8 pt-10">
        <div className="grid gap-x-8 gap-y-8 sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <div>
            <Link href="/" className="font-display text-2xl text-white">
              Bay Area <span className="text-kicker">Desi</span> Karaoke
            </Link>
            <p className="mt-2 max-w-xs text-sm text-white/70">
              Find and sign up for Desi karaoke nights run by groups around the Bay Area.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-kicker">{column.heading}</h2>
              <ul className="mt-3 space-y-2 text-[0.95rem]">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-white/85 hover:text-kicker">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/15 pt-6 text-sm text-white/65 sm:flex-row sm:items-center sm:gap-6">
          <p>© {year} Bay Area Desi Karaoke</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-kicker">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
