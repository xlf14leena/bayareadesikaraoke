"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import FormStatus from "@/components/admin/FormStatus";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/lib/forms";
import { shrinkImage } from "@/lib/shrink-image";

const MAX_BYTES = 4 * 1024 * 1024;

export default function ScreenshotForm({
  action,
  label,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  label: string;
}) {
  const [state, run, pending] = useActionState(action, undefined);
  const [localError, setLocalError] = useState<string>();
  const [preparing, setPreparing] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(undefined);
    const input = e.currentTarget.elements.namedItem("screenshot") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return setLocalError("Choose a screenshot of your Zelle payment.");
    setPreparing(true);
    const ready = await shrinkImage(file);
    setPreparing(false);
    if (ready.size > MAX_BYTES) {
      return setLocalError("That image is too large. A phone screenshot of the payment works best.");
    }
    const data = new FormData();
    data.set("screenshot", ready);
    startTransition(() => run(data));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <input
        type="file"
        name="screenshot"
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"
        required
        className={`${inputClass} file:mr-3 file:rounded-full file:border-0 file:bg-mist file:px-3 file:py-1 file:text-sm`}
      />
      <FormStatus
        state={localError ? { error: localError } : state}
        pending={pending || preparing}
        label={label}
      />
    </form>
  );
}
