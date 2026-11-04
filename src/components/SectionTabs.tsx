"use client";

import { useEffect, useState } from "react";

export type SectionTab = { id: string; label: string; icon: keyof typeof ICONS };

// Outline icons (24px, stroke), in the same style as the tab bar's text.
const ICONS = {
  details: <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />,
  slots: <path d="M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" />,
  signup: <path d="M3 9a3 3 0 0 0 0 6v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a3 3 0 0 1 0-6V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3ZM13 5v2M13 11v2M13 17v2" />,
  order: <path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />,
  singers: <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />,
  comments: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
};

/**
 * Tab bar of jump links to the sections on the event page: icon and label,
 * with an underline under the section you're reading. Sticks under the site
 * header as you scroll. Pass only the sections that are showing.
 */
export default function SectionTabs({ tabs }: { tabs: SectionTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const [top, setTop] = useState(0);

  useEffect(() => {
    // Stick right under the site header, whose height changes (e.g. the "View site as" bar).
    const header = document.querySelector("body > header");
    if (!header) return;
    const measure = () => setTop(header.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    // The active tab is the last section whose top has scrolled past the bar.
    const update = () => {
      let current = tabs[0]?.id;
      for (const t of tabs) {
        const el = document.getElementById(t.id);
        if (el && el.getBoundingClientRect().top <= top + 80) current = t.id;
      }
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) current = tabs[tabs.length - 1]?.id;
      setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [tabs, top]);

  if (tabs.length < 2) return null;
  return (
    <nav aria-label="On this page" style={{ top }} className="sticky z-[5] -mx-4 bg-mist px-4">
      <ul className="-mb-px flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none] sm:gap-3">
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <li key={t.id} className="shrink-0">
              <a
                href={`#${t.id}`}
                aria-current={on ? "location" : undefined}
                className={`flex items-center gap-2 border-b-[3px] px-2 pb-2.5 pt-3 text-[15px] whitespace-nowrap transition-colors sm:px-3 ${
                  on ? "border-gold font-medium text-royal" : "border-transparent text-ink-muted hover:text-royal"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {ICONS[t.icon]}
                </svg>
                {t.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
