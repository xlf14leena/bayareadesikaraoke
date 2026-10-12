"use client";

import { setViewAs } from "@/app/view-as-actions";

/** Dropdown that switches the "View as" role as soon as an option is picked. */
export default function ViewAsSelect({
  current,
  options,
}: {
  current: string;
  options: { value: string; label: string }[];
}) {
  return (
    <form action={setViewAs}>
      <label className="flex items-center gap-2">
        <span className="whitespace-nowrap">View site as</span>
        <select
          name="viewAs"
          defaultValue={current}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="max-w-[12rem] rounded-full border border-line bg-white px-3 py-1 text-sm text-ink sm:max-w-none"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <noscript>
        <button type="submit" className="ml-2 underline">
          Go
        </button>
      </noscript>
    </form>
  );
}
