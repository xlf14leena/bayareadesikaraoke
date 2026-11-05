"use client";

import { useEffect, useRef } from "react";

/**
 * A panel that slides in from the right over the page, e.g. the "Add someone"
 * form on a date's admin page. Open it with an OpenPanelButton that has the same id.
 * Escape, the close button or a click on the dimmed page closes it.
 */
export default function SidePanel({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // Clicks on the backdrop land on the dialog itself, outside its inner box.
    const onClick = (e: MouseEvent) => {
      if (e.target === dialog) dialog.close();
    };
    dialog.addEventListener("click", onClick);
    return () => dialog.removeEventListener("click", onClick);
  }, []);

  return (
    <dialog
      ref={ref}
      id={id}
      aria-labelledby={`${id}-title`}
      className="fixed inset-y-0 right-0 left-auto m-0 h-full max-h-none w-full max-w-xl bg-mist p-0 text-ink shadow-2xl backdrop:bg-ink/40"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-line bg-white px-4 py-4 sm:px-5">
          <div>
            <h2 id={`${id}-title`} className="text-xl font-semibold">
              {title}
            </h2>
            {note && <p className="text-sm text-ink-muted">{note}</p>}
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="rounded-full p-2 text-ink-muted hover:bg-mist hover:text-royal"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </dialog>
  );
}

/** A button that opens the SidePanel with this id. */
export function OpenPanelButton({
  panel,
  className,
  children,
}: {
  panel: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => (document.getElementById(panel) as HTMLDialogElement | null)?.showModal()}
    >
      {children}
    </button>
  );
}
