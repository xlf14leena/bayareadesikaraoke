"use client";

import { useEffect, useRef } from "react";

/** Class for a link or button shown as a row in a MoreMenu. */
export const menuItem = "flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm text-ink cursor-pointer hover:bg-mist active:bg-lapis/15";
/** A MoreMenu row that removes or cancels something. */
export const menuDangerItem = "flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm text-red-700 cursor-pointer hover:bg-red-50 active:bg-red-100";

/**
 * A "⋯" button that opens a small menu of less-used actions.
 * `up` opens it above the button, for a bar at the bottom of the screen.
 */
export default function MoreMenu({
  children,
  trigger,
  up = false,
}: {
  children: React.ReactNode;
  trigger: React.ReactNode;
  up?: boolean;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    // Close on a click outside the menu or on Escape.
    const close = (e: Event) => {
      const el = ref.current;
      if (!el?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  return (
    <details ref={ref} className="relative">
      <summary className="list-none [&::-webkit-details-marker]:hidden">{trigger}</summary>
      <div
        className={`absolute right-0 z-30 w-60 rounded-xl border border-line bg-white p-1.5 shadow-xl ${
          up ? "bottom-full mb-2" : "top-full mt-2"
        }`}
      >
        {children}
      </div>
    </details>
  );
}
