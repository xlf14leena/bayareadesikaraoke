"use client";

import { useEffect, useRef, useState } from "react";
import Field from "@/components/admin/Field";
import FormStatus from "@/components/admin/FormStatus";
import { useFormAction } from "@/components/admin/useFormAction";
import { type DuetPartnerOption, SongFields } from "@/components/signup/SongsForm";
import { inputClass, selectClass } from "@/components/ui";
import type { FormState } from "@/lib/forms";
import type { RoundConfig } from "@/lib/rounds";

/** Adds someone by hand. They're confirmed at once; a singer's songs follow the first-pick rule. */
export default function AddPersonForm({
  action,
  partners,
  rounds,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  partners: DuetPartnerOption[];
  rounds: RoundConfig[];
}) {
  const { state, onSubmit, pending } = useFormAction(action);
  const [role, setRole] = useState("SINGER");
  const form = useRef<HTMLFormElement>(null);
  // Clear the fields after someone is added, ready for the next person.
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input name="displayName" required maxLength={60} className={inputClass} />
        </Field>
        <Field label="Singer or listener">
          <select name="role" value={role} onChange={(e) => setRole(e.target.value)} className={selectClass}>
            <option value="SINGER">Singer</option>
            <option value="LISTENER">Listener</option>
          </select>
        </Field>
        <Field label="Email (optional)" hint="If they later sign in with this Google address, the sign-up shows in their My events.">
          <input name="email" type="email" maxLength={120} className={inputClass} />
        </Field>
        <Field label="How they paid (optional)" hint='For example "cash at door".'>
          <input name="paymentNote" maxLength={120} className={inputClass} />
        </Field>
      </div>
      {role === "SINGER" && <SongFields rounds={rounds} partners={partners} nearMatch={state?.nearMatch} />}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="overCap" className="accent-royal" />
        Go over the cap if this role is full
      </label>
      <FormStatus state={state} pending={pending} label="Add person" />
    </form>
  );
}
