"use client";

import FormStatus from "@/components/admin/FormStatus";
import { useFormAction } from "@/components/admin/useFormAction";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/lib/forms";

export default function AddAdminForm({ action }: { action: (prev: FormState, form: FormData) => Promise<FormState> }) {
  const { state, onSubmit, pending } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} className="space-y-1">
      <label className="block">
        <span className="sr-only">Email</span>
        <input name="email" type="email" required placeholder="Their Google email" className={inputClass} />
      </label>
      <FormStatus state={state} pending={pending} label="Add admin" />
    </form>
  );
}
