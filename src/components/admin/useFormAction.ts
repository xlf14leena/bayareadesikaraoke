"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { FormState } from "@/lib/forms";

/**
 * Runs a server action from onSubmit instead of the form's action prop, so
 * React doesn't clear the fields when the action returns an error.
 */
export function useFormAction(action: (prev: FormState, form: FormData) => Promise<FormState>) {
  const [state, run, pending] = useActionState(action, undefined);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => run(data));
  };
  return { state, onSubmit, pending };
}
