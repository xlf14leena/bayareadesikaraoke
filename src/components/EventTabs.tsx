"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Outline icons (24px, stroke), in the same style as the tab bar's text.
const ICONS = {
  tonight: <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />,
  details: <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />,
  signup: <path d="M3 9a3 3 0 0 0 0 6v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a3 3 0 0 1 0-6V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3ZM13 5v2M13 11v2M13 17v2" />,
  singers: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  comments: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
};

export type EventTab = {
  id: string;
  label: string;
  icon: keyof typeof ICONS;
  count?: number;
  /** Older links that should open this tab, e.g. #running-order for the Tonight tab. */
  aliases?: string[];
  content: ReactNode;
};

/**
 * The event page's sections as real tabs: one panel shows at a time, so the
 * page stays short. The page picks which tab opens first (`initial`); a link
 * with #<tab id> opens that tab instead. The bar sticks under the site header.
 */
export default function EventTabs({ tabs, initial }: { tabs: EventTab[]; initial: string }) {
  const [active, setActive] = useState(initial);
  const [top, setTop] = useState(0);
  const bar = useRef<HTMLDivElement>(null);

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
    // A link to #comments (or an older section link) opens that tab.
    const fromHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      const tab = tabs.find((t) => t.id === hash || t.aliases?.includes(hash));
      if (tab) setActive(tab.id);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [tabs]);

  const open = (id: string) => {
    setActive(id);
    history.replaceState(null, "", `#${id}`);
    // If the bar is stuck to the top, bring the new panel's start into view.
    const el = bar.current;
    if (el) {
      const barTop = el.parentElement!.getBoundingClientRect().top + window.scrollY - top;
      if (window.scrollY > barTop) window.scrollTo({ top: barTop });
    }
  };

  const shown = tabs.some((t) => t.id === active) ? active : tabs[0]?.id;

  useEffect(() => {
    // On a phone the bar scrolls sideways: keep the open tab in sight.
    const list = bar.current?.firstElementChild as HTMLElement | null;
    const btn = document.getElementById(`tab-${shown}`);
    if (!list || !btn) return;
    const left = btn.offsetLeft - list.offsetLeft;
    if (left < list.scrollLeft || left + btn.offsetWidth > list.scrollLeft + list.clientWidth)
      list.scrollLeft = left - (list.clientWidth - btn.offsetWidth) / 2;
  }, [shown]);
  if (tabs.length === 0) return null;
  return (
    <div>
      <div ref={bar} style={{ top }} className="sticky z-[5] -mx-4 bg-mist px-4">
        <div role="tablist" aria-label="Event sections" className="-mb-px flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none] sm:gap-3">
          {tabs.map((t) => {
            const on = t.id === shown;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={on}
                aria-controls={t.id}
                onClick={() => open(t.id)}
                className={`flex shrink-0 cursor-pointer items-center gap-2 border-b-[3px] px-2 pb-2.5 pt-3 text-[15px] whitespace-nowrap transition-colors sm:px-3 ${
                  on ? "border-gold font-medium text-royal" : "border-transparent text-ink-muted hover:text-royal"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {ICONS[t.icon]}
                </svg>
                {t.label}
                {t.count != null && t.count > 0 && (
                  <span className="rounded-full bg-line/70 px-1.5 text-xs font-medium tabular-nums text-ink-muted">{t.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {tabs.map((t) => (
        // Every panel is rendered so forms keep what was typed when you switch tabs.
        <div key={t.id} id={t.id} role="tabpanel" aria-labelledby={`tab-${t.id}`} hidden={t.id !== shown} className="pt-5">
          {t.content}
        </div>
      ))}
    </div>
  );
}
