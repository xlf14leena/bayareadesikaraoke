"use client";

import { useFormAction } from "@/components/admin/useFormAction";
import { primaryButton } from "@/components/ui";
import type { FormState } from "@/lib/forms";

/** The guest's "Check me in" button on the check-in page. */
export default function CheckInButton({ action }: { action: (prev: FormState, form: FormData) => Promise<FormState> }) {
  const { state, onSubmit, pending } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <button type="submit" className={`${primaryButton} w-full py-3 text-base`} disabled={pending}>
        {pending ? "Checking you in…" : "Check me in"}
      </button>
      {state?.error && !pending && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
