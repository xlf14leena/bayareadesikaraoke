import { badgeClass } from "@/components/ui";

/** Says at a glance whether an event repeats on a schedule or happens once. */
export default function ScheduleBadge({ frequency }: { frequency: string }) {
  if (frequency === "ONCE") {
    return (
      <span className={`${badgeClass} bg-gold/30 text-gold-ink`}>
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        One-time
      </span>
    );
  }
  return (
    <span className={`${badgeClass} bg-lapis/10 text-cobalt`}>
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12a9 9 0 0 1-15.36 6.36L3 16" />
        <path d="M3 12a9 9 0 0 1 15.36-6.36L21 8" />
        <path d="M21 3v5h-5M3 21v-5h5" />
      </svg>
      Recurring
    </span>
  );
}
