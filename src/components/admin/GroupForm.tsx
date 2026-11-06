"use client";

import type { Group } from "@prisma/client";
import BannerField from "@/components/admin/BannerField";
import Field from "@/components/admin/Field";
import FormSection from "@/components/admin/FormSection";
import FormStatus from "@/components/admin/FormStatus";
import { useFormAction } from "@/components/admin/useFormAction";
import GroupThumb from "@/components/GroupThumb";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/lib/forms";
import type { GroupThumbnail } from "@/lib/group-thumbnail";

type Action = (prev: FormState, form: FormData) => Promise<FormState>;

/**
 * Create or edit a group. The admin emails box shows only when creating.
 * `fallbackThumb` is what the lists show while the group has no thumbnail.
 */
export default function GroupForm({
  action,
  group,
  fallbackThumb,
}: {
  action: Action;
  group?: Group;
  fallbackThumb?: GroupThumbnail;
}) {
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
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <BannerField
          current={group?.bannerUrl ?? null}
          hint="Shown on the group page and used for events that have no banner of their own. Without one, the default singing photo is used."
        />
        <BannerField
          field="thumbnail"
          current={group?.thumbnailUrl ?? null}
          fallback={
            fallbackThumb && (
              <span className="shrink-0 overflow-hidden rounded-xl border border-line bg-mist">
                <GroupThumb thumb={fallbackThumb} className="h-28 w-28" text="text-4xl" />
              </span>
            )
          }
          hint="Shown beside the group's events on the home page and the group page. Without one, the banner is cropped to fit, or the newest event's banner, or the group's initials."
        />
      </div>
      <FormSection title="Links" note="optional">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Website">
            <input name="websiteUrl" inputMode="url" defaultValue={group?.websiteUrl ?? ""} placeholder="https://..." className={inputClass} />
          </Field>
          <Field label="Facebook page">
            <input name="facebookUrl" inputMode="url" defaultValue={group?.facebookUrl ?? ""} placeholder="https://facebook.com/..." className={inputClass} />
          </Field>
          <Field label="Instagram page">
            <input name="instagramUrl" inputMode="url" defaultValue={group?.instagramUrl ?? ""} placeholder="https://instagram.com/..." className={inputClass} />
          </Field>
        </div>
        <p className="text-xs text-ink-muted">Shown as icon links under the group name on the group page.</p>
      </FormSection>
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
