"use client";

import { useFormStatus } from "react-dom";

/** A small spinning ring, sized to sit beside a button's text. */
export function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 animate-spin" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The submit button for a form that runs a server action through its action
 * prop. While the action runs it shows a spinner and can't be pressed again.
 */
export default function SubmitButton({ className, children }: { className: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending || undefined}>
      {pending && <Spinner />}
      {children}
    </button>
  );
}
