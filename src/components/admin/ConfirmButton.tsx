"use client";

import { dangerButton, secondaryButton } from "@/components/ui";

/** A one-button form that asks before running a server action. */
export default function ConfirmButton({
  action,
  label,
  confirm,
  danger = true,
}: {
  action: () => Promise<void>;
  label: string;
  confirm: string;
  danger?: boolean;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      <button type="submit" className={danger ? dangerButton : secondaryButton}>
        {label}
      </button>
    </form>
  );
}
