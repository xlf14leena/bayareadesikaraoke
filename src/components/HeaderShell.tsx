"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Group and event pages open with a full-width poster right under the header.
const POSTER_PAGE = /^\/g\/[^/]+(\/[^/]+)?\/?$/;

/**
 * The header's frame, which changes with the page:
 * - Home: floats over the hero photo (the photo starts at the top of the window)
 *   with white text on a soft dark fade, and turns back to the light header once
 *   you scroll.
 * - Group and event pages: solid dark indigo, so it blends into the poster below
 *   without covering the poster's title.
 * - Everywhere else: the light header.
 * Children style themselves for the dark look with `group-data-[tone=dark]:`.
 */
export default function HeaderShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!isHome) return;
    const update = () => setScrolled(window.scrollY > 40);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [isHome]);

  const overlay = isHome && !scrolled;
  const dark = overlay || POSTER_PAGE.test(pathname);

  const frame = isHome
    ? overlay
      ? "fixed inset-x-0 top-0 bg-gradient-to-b from-[rgb(18_20_66/0.75)] to-transparent"
      : "fixed inset-x-0 top-0 border-b border-line bg-mist/90 backdrop-blur"
    : dark
      ? "sticky top-0 bg-royal"
      : "sticky top-0 border-b border-line bg-mist/90 backdrop-blur";

  return (
    <header data-tone={dark ? "dark" : "light"} className={`group z-10 transition-colors duration-200 ${frame}`}>
      {children}
    </header>
  );
}
