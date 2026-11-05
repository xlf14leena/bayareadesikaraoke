"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";

export type FilterGroup = {
  key: string;
  label: string;
  empty: string;
  /** Show a gold dot on the chip while the group has anyone in it (it needs the admin). */
  alert?: boolean;
  rows: { id: string; name: string; node: React.ReactNode }[];
};

/**
 * The sign-ups list on a date's admin page: one chip per status with its count,
 * showing that status's sign-ups, plus "All" and a name search across every status.
 */
export default function SignUpFilter({ groups, initial }: { groups: FilterGroup[]; initial: string }) {
  const [active, setActive] = useState(initial);
  const [query, setQuery] = useState("");
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const shown = searching || active === "all" ? groups : groups.filter((g) => g.key === active);
  const match = (name: string) => !searching || name.toLowerCase().includes(q);

  const chip = (key: string, label: string, count: number, alert = false) => {
    const on = !searching && active === key;
    return (
      <button
        key={key}
        type="button"
        aria-pressed={on}
        onClick={() => {
          setActive(key);
          setQuery("");
        }}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
          on ? "border-royal bg-royal text-white" : "border-line bg-white text-royal hover:border-lapis"
        }`}
      >
        {alert && count > 0 && <span aria-hidden className="h-2 w-2 rounded-full bg-gold" />}
        {label}
        <span className={`font-normal ${on ? "text-white/70" : "text-ink-muted"}`}>{count}</span>
      </button>
    );
  };

  const visible = shown.map((g) => ({ ...g, rows: g.rows.filter((r) => match(r.name)) }));
  const nothing = visible.every((g) => g.rows.length === 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="-mx-4 flex flex-1 gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          {groups.map((g) => chip(g.key, g.label, g.rows.length, g.alert))}
          {chip("all", "All", total)}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search names"
          aria-label="Search sign-ups by name"
          className={`${inputClass} !py-1.5 sm:!w-48`}
        />
      </div>

      {searching && nothing ? (
        <p className="text-sm text-ink-muted">Nobody called &ldquo;{query.trim()}&rdquo; has signed up.</p>
      ) : (
        visible.map((g) =>
          shown.length > 1 ? (
            g.rows.length > 0 && (
              <div key={g.key} className="space-y-3">
                <h3 className="font-semibold text-royal">
                  {g.label} <span className="font-normal text-ink-muted">({g.rows.length})</span>
                </h3>
                <ul className="space-y-3">{g.rows.map((r) => <li key={r.id}>{r.node}</li>)}</ul>
              </div>
            )
          ) : g.rows.length === 0 ? (
            <p key={g.key} className="text-sm text-ink-muted">
              {g.empty}
            </p>
          ) : (
            <ul key={g.key} className="space-y-3">
              {g.rows.map((r) => (
                <li key={r.id}>{r.node}</li>
              ))}
            </ul>
          ),
        )
      )}
      {!searching && active === "all" && total === 0 && <p className="text-sm text-ink-muted">Nobody has signed up yet.</p>}
    </div>
  );
}
