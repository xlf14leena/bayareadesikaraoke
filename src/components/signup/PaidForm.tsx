"use client";

import { useActionState } from "react";
import FormStatus from "@/components/admin/FormStatus";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/lib/forms";

/**
 * "I've paid" honor checkbox, plus the optional name on the person's Zelle account
 * so organizers can find the payment if the memo is missing. No screenshot is asked for.
 */
export default function PaidForm({
  action,
  amount,
  memoCode,
  zelleName,
  label,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  amount: string;
  memoCode: string;
  zelleName: string | null;
  label: string;
}) {
  const [state, run, pending] = useActionState(action, undefined);
  return (
    <form action={run} className="space-y-3">
      <label className="flex items-start gap-2">
        <input type="checkbox" name="paid" required className="mt-0.5 size-4 shrink-0 accent-royal" />
        <span>
          I&apos;ve sent <strong>{amount}</strong> by Zelle with memo code{" "}
          <span className="font-mono font-semibold">{memoCode}</span>.
        </span>
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Name on your Zelle account <span className="font-normal normal-case tracking-normal">(optional)</span>
        </span>
        <input
          type="text"
          name="zelleName"
          maxLength={80}
          defaultValue={zelleName ?? ""}
          autoComplete="name"
          placeholder="Helps the organizers find your payment"
          className={inputClass}
        />
      </label>
      <FormStatus state={state} pending={pending} label={label} />
    </form>
  );
}
