"use client";

import type { Group } from "@prisma/client";
import Field from "@/components/admin/Field";
import FormStatus from "@/components/admin/FormStatus";
import { useFormAction } from "@/components/admin/useFormAction";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/lib/forms";

type Action = (prev: FormState, form: FormData) => Promise<FormState>;

/** Create or edit a group. The admin emails box shows only when creating. */
export default function GroupForm({ action, group }: { action: Action; group?: Group }) {
  const { state, onSubmit, pending } = useFormAction(action);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Group name">
          <input name="name" required maxLength={80} defaultValue={group?.name} className={inputClass} />
        </Field>
        <Field label="Web address" hint="Letters, numbers and dashes. Blank uses the name.">
          <div className="flex items-center gap-1">
            <span className="text-sm text-ink-muted">/g/</span>
            <input name="slug" defaultValue={group?.slug} placeholder="sur-sangam" className={inputClass} />
          </div>
        </Field>
      </div>
      <Field label="Description (optional)">
        <textarea name="description" rows={3} defaultValue={group?.description ?? ""} className={inputClass} />
      </Field>
      <Field label="Banner image link (optional)" hint="Shown on the group page and used for events that have no banner of their own.">
        <input
          name="bannerUrl"
          type="url"
          defaultValue={group?.bannerUrl ?? ""}
          placeholder="https://…"
          className={inputClass}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Zelle recipient name (optional)">
          <input name="zelleName" defaultValue={group?.zelleName ?? ""} className={inputClass} />
        </Field>
        <Field label="Zelle email or phone (optional)">
          <input name="zelleHandle" defaultValue={group?.zelleHandle ?? ""} className={inputClass} />
        </Field>
      </div>
      {!group && (
        <Field
          label="Group admins (optional)"
          hint="Their Google sign-in emails, separated by commas. Each person must have signed in to the site once."
        >
          <textarea name="adminEmails" rows={2} className={inputClass} placeholder="admin@example.com" />
        </Field>
      )}
      <FormStatus state={state} pending={pending} label={group ? "Save group" : "Create group"} />
    </form>
  );
}
