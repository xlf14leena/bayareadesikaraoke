"use client";

import { dangerButton, secondaryButton } from "@/components/ui";

/** A one-button form that asks before running a server action. */
export default function ConfirmButton({
  action,
  label,
  confirm,
  danger = true,
  className,
}: {
  action: () => Promise<void>;
  label: string;
  confirm: string;
  danger?: boolean;
  /** Replaces the button's look, e.g. to show it as a menu item. */
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      <button type="submit" className={className ?? (danger ? dangerButton : secondaryButton)}>
        {label}
      </button>
    </form>
  );
}
