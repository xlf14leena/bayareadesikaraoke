"use client";

import { useState } from "react";
import Field from "@/components/admin/Field";
import FormStatus from "@/components/admin/FormStatus";
import { useFormAction } from "@/components/admin/useFormAction";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/lib/forms";

const LABELS = ["Poor", "Fair", "Good", "Great", "Amazing"];

/** A 1 to 5 star rating plus an optional comment. */
export default function FeedbackForm({
  action,
  rating: initialRating,
  comment,
  maxComment,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  rating: number | null;
  comment: string;
  maxComment: number;
}) {
  const { state, onSubmit, pending } = useFormAction(action);
  const [rating, setRating] = useState<number | null>(initialRating);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">How was the night?</legend>
        <div className="flex flex-wrap gap-2">
          {LABELS.map((label, i) => {
            const value = i + 1;
            const on = rating != null && value <= rating;
            return (
              <label
                key={value}
                className={`flex cursor-pointer flex-col items-center rounded-lg border px-3 py-2 text-xs has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-lapis/40 ${
                  rating === value ? "border-lapis bg-lapis/5" : "border-line"
                }`}
              >
                <input
                  type="radio"
                  name="rating"
                  value={value}
                  checked={rating === value}
                  onChange={() => setRating(value)}
                  className="sr-only"
                  required
                />
                <span aria-hidden className={`text-2xl leading-none ${on ? "text-gold" : "text-ink-muted/30"}`}>
                  ★
                </span>
                <span className="mt-1">{label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <Field label="Anything you'd like the organizers to know?" hint="Optional. Only the group's organizers see this.">
        <textarea name="comment" defaultValue={comment} rows={5} maxLength={maxComment} className={inputClass} />
      </Field>
      <FormStatus state={state} pending={pending} label={initialRating ? "Update feedback" : "Send feedback"} />
    </form>
  );
}
