"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";

type Row = { id: string; name: string; node: React.ReactNode };

/** Above this many people, the check-in list gets a name search. */
const SEARCH_FROM = 8;

/**
 * The people list in a date's Check-in section: who isn't here yet (each with a
 * Check in button) and who is, with a name search once the list gets long.
 */
export default function CheckInList({ notYet, arrived }: { notYet: Row[]; arrived: Row[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const match = (r: Row) => !q || r.name.toLowerCase().includes(q);
  const groups = [
    { key: "not-yet", label: "Not here yet", rows: notYet.filter(match) },
    { key: "here", label: "Here", rows: arrived.filter(match) },
  ];

  return (
    <div className="space-y-4">
      {notYet.length + arrived.length > SEARCH_FROM && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search names"
          aria-label="Search check-in list by name"
          className={`${inputClass} !py-1.5 sm:!w-64`}
        />
      )}
      {q && groups.every((g) => g.rows.length === 0) ? (
        <p className="text-sm text-ink-muted">Nobody called &ldquo;{query.trim()}&rdquo; holds a spot.</p>
      ) : (
        groups.map(
          (g) =>
            g.rows.length > 0 && (
              <div key={g.key} className="space-y-2">
                <h3 className="text-sm font-semibold text-royal">
                  {g.label} <span className="font-normal text-ink-muted">({g.rows.length})</span>
                </h3>
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {g.rows.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      {r.node}
                    </li>
                  ))}
                </ul>
              </div>
            ),
        )
      )}
    </div>
  );
}
