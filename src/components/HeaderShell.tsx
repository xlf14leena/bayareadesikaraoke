"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * The header's frame, which changes with the page:
 * - Home: floats over the hero photo (the photo starts at the top of the window)
 *   with white text on a soft dark fade, and fills in solid dark indigo once you
 *   scroll, so it stays the same colour as on every other page.
 * - Every other page: solid dark indigo, the same on group and event pages
 *   (where it blends into the poster below), My events and admin.
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

  const frame = isHome
    ? overlay
      ? "fixed inset-x-0 top-0 bg-gradient-to-b from-[rgb(18_20_66/0.75)] to-transparent"
      : "fixed inset-x-0 top-0 bg-royal"
    : "sticky top-0 bg-royal";

  return (
    <header data-tone="dark" className={`group z-10 transition-colors duration-200 ${frame}`}>
      {children}
    </header>
  );
}
