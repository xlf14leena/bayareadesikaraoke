import Field from "@/components/admin/Field";
import { inputClass } from "@/components/ui";

/** Optional theme, plus whether songs must fit it. */
export default function ThemeFields({ theme, required, hint }: { theme?: string | null; required?: boolean; hint: string }) {
  return (
    <div className="space-y-2">
      <Field label="Theme (optional)" hint={hint}>
        <input name="theme" maxLength={120} defaultValue={theme ?? ""} placeholder="90s Bollywood" className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="themeRequired" defaultChecked={required ?? true} />
        Songs must fit the theme (untick to make it a suggestion)
      </label>
    </div>
  );
}
