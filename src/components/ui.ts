// Shared Tailwind class strings for admin forms and buttons.

export const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-ink placeholder:text-ink-muted/60 focus:border-lapis focus:outline-none focus:ring-2 focus:ring-lapis/30";
/** A dropdown as wide as its longest option, with the chevron just after the text. */
export const selectClass =
  "select-chevron w-auto max-w-full rounded-lg border border-line bg-white py-2 pl-3 text-ink focus:border-lapis focus:outline-none focus:ring-2 focus:ring-lapis/30";
export const labelClass = "mb-1 block text-sm font-medium text-ink";
export const hintClass = "mt-1 text-xs text-ink-muted";
export const cardClass = "rounded-xl border border-line bg-white p-4 sm:p-6";

/*
 * Buttons. Every action in the app (submit, edit, manage, open a page to change
 * something) uses one of these three, so they share one shape and size:
 * a pill with the same padding, text size and weight. Plain text links are
 * only for links inside a sentence and for navigation.
 */
const buttonBase =
  "btn inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium select-none transition duration-150 active:scale-[0.96] active:duration-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lapis disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 aria-busy:cursor-progress";
/*
 * Each button has three looks: hover (mouse only; Tailwind skips hover on
 * touch screens), pressed (darker fill while a finger or the mouse is down,
 * plus a slight shrink) and a keyboard focus ring.
 */
/** The main action on a page or card. */
export const primaryButton = `${buttonBase} border-royal bg-royal text-white hover:border-cobalt hover:bg-cobalt active:border-ink active:bg-ink`;
/** Other actions: Manage, View, Edit, Cancel. */
export const secondaryButton = `${buttonBase} border-line bg-white text-royal hover:border-lapis hover:bg-mist hover:text-cobalt active:border-lapis active:bg-lapis/15 active:text-royal`;
/** Deleting or removing something. */
export const dangerButton = `${buttonBase} border-red-200 bg-white text-red-700 hover:bg-red-50 active:border-red-300 active:bg-red-100`;

/** Small status pill next to a title, e.g. "Recurring" or "Sign-ups open". */
export const badgeClass = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium align-middle";
