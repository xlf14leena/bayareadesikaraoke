"use client";

import { useFormAction } from "@/components/admin/useFormAction";
import { dangerButton, inputClass } from "@/components/ui";
import type { FormState } from "@/lib/forms";

/** A reason box plus a button, for rejecting a payment or a song. Folded away until opened. */
export default function ReasonForm({
  action,
  label,
  placeholder,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  label: string;
  placeholder: string;
}) {
  const { state, onSubmit, pending } = useFormAction(action);
  return (
    <details className="text-sm">
      <summary className={`${dangerButton} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>{label}</summary>
      <form onSubmit={onSubmit} className="mt-2 flex flex-wrap items-center gap-2">
        <input name="reason" required maxLength={300} placeholder={placeholder} className={`${inputClass} flex-1`} />
        <button type="submit" className={dangerButton} disabled={pending}>
          {pending ? "Saving…" : label}
        </button>
        {state?.error && !pending && (
          <p role="alert" className="w-full text-red-700">
            {state.error}
          </p>
        )}
      </form>
    </details>
  );
}
