"use client";

import { useEffect, useRef, useState } from "react";
import { useFormAction } from "@/components/admin/useFormAction";
import { dangerButton, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import type { FormState } from "@/lib/forms";

type Action = (prev: FormState, form: FormData) => Promise<FormState>;

/** New comment or question. Clears itself once posted. */
export function CommentForm({ action }: { action: Action }) {
  const { state, onSubmit, pending } = useFormAction(action);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-2">
      <label htmlFor="comment-body" className="sr-only">
        Your comment or question
      </label>
      <textarea
        id="comment-body"
        name="body"
        rows={3}
        maxLength={1000}
        required
        placeholder="Say hi, or ask the organizers a question…"
        className={inputClass}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="isQuestion" className="h-4 w-4 accent-royal" />
          This is a question for the organizers
        </label>
        <button type="submit" className={`${primaryButton} ml-auto`} disabled={pending}>
          {pending ? "Posting…" : "Post"}
        </button>
      </div>
      <Status state={state} pending={pending} />
    </form>
  );
}

/** "Reply" button that opens a small reply box under a comment. */
export function ReplyForm({ action }: { action: Action }) {
  const [open, setOpen] = useState(false);
  const { state, onSubmit, pending } = useFormAction(action);
  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={secondaryButton}>
        Reply
      </button>
    );
  }
  return (
    <form onSubmit={onSubmit} className="w-full space-y-2">
      <textarea
        name="body"
        rows={2}
        maxLength={1000}
        required
        autoFocus
        aria-label="Your reply"
        placeholder="Write a reply…"
        className={inputClass}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className={primaryButton} disabled={pending}>
          {pending ? "Posting…" : "Reply"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={secondaryButton}>
          Cancel
        </button>
      </div>
      <Status state={state} pending={pending} />
    </form>
  );
}

/** "Delete" button that asks first. */
export function DeleteCommentButton({ action, hasReplies }: { action: () => Promise<void>; hasReplies: boolean }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(hasReplies ? "Delete this comment and its replies?" : "Delete this comment?")) e.preventDefault();
      }}
    >
      <button type="submit" className={dangerButton}>
        Delete
      </button>
    </form>
  );
}

function Status({ state, pending }: { state: FormState; pending: boolean }) {
  if (pending || !state?.error) return null;
  return (
    <p role="alert" className="text-sm text-red-700">
      {state.error}
    </p>
  );
}
