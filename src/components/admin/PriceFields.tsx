"use client";

import { useState } from "react";
import Field from "@/components/admin/Field";
import { inputClass } from "@/components/ui";
import { dollars } from "@/lib/forms";

/**
 * Singer and listener prices, with a "Free event" box that sets both to $0
 * and hides the price boxes (read by prices() in src/lib/forms.ts). One role
 * can still be free on its own by entering 0 for it.
 */
export default function PriceFields({
  singerCents,
  listenerCents,
  hint,
}: {
  /** Starting prices; undefined leaves the boxes blank (a new event). */
  singerCents?: number;
  listenerCents?: number;
  hint?: string;
}) {
  const [free, setFree] = useState(singerCents === 0 && listenerCents === 0);
  return (
    <div className="space-y-3 sm:col-span-2">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="free" checked={free} onChange={(e) => setFree(e.target.checked)} />
        Free event (no payment for singers or listeners)
      </label>
      {!free && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Singer price ($)" hint={hint}>
            <input
              name="singerPrice"
              inputMode="decimal"
              defaultValue={singerCents == null ? "" : dollars(singerCents)}
              placeholder="20"
              className={inputClass}
            />
          </Field>
          <Field label="Listener price ($)" hint={hint}>
            <input
              name="listenerPrice"
              inputMode="decimal"
              defaultValue={listenerCents == null ? "" : dollars(listenerCents)}
              placeholder="10"
              className={inputClass}
            />
          </Field>
        </div>
      )}
    </div>
  );
}
