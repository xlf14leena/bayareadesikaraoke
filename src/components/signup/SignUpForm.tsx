"use client";

import { useState } from "react";
import type { AttendeeRole } from "@prisma/client";
import Field from "@/components/admin/Field";
import FormStatus from "@/components/admin/FormStatus";
import { useFormAction } from "@/components/admin/useFormAction";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/lib/forms";

export type RoleOption = { role: AttendeeRole; label: string; price: string; full: boolean };

/** Name plus singer-or-listener choice. A full role offers its waitlist instead. */
export default function SignUpForm({
  action,
  defaultName,
  options,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  defaultName: string;
  options: RoleOption[];
}) {
  const { state, onSubmit, pending } = useFormAction(action);
  const [role, setRole] = useState<AttendeeRole>(options[0].role);
  const chosen = options.find((o) => o.role === role)!;

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">I want to</legend>
        {options.map((o) => (
          <label
            key={o.role}
            className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
              role === o.role ? "border-lapis bg-lapis/5" : "border-line"
            }`}
          >
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name="role"
                value={o.role}
                checked={role === o.role}
                onChange={() => setRole(o.role)}
                className="accent-royal"
              />
              <span>
                {o.label}
                {o.full && <span className="block text-xs text-ink-muted">Full: join the waitlist</span>}
              </span>
            </span>
            <span className="font-semibold">{o.price}</span>
          </label>
        ))}
      </fieldset>
      <Field label="Your name" hint="Shown on the singer list for this event.">
        <input name="displayName" defaultValue={defaultName} required maxLength={60} className={inputClass} />
      </Field>
      <FormStatus state={state} pending={pending} label={chosen.full ? "Join waitlist" : "Sign up"} />
    </form>
  );
}
