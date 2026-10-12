import { primaryButton } from "@/components/ui";
import type { FormState } from "@/lib/forms";

/** Submit button plus the form's error or success message. */
export default function FormStatus({ state, pending, label }: { state: FormState; pending: boolean; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-2">
      <button type="submit" className={primaryButton} disabled={pending}>
        {pending ? "Saving…" : label}
      </button>
      {state?.error && !pending && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state?.ok && !pending && (
        <p role="status" className="text-sm text-emerald-700">
          {state.ok}
        </p>
      )}
    </div>
  );
}
