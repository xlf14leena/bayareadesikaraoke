/**
 * Row of jump links to the sections on a page. Pass only the sections that
 * are on the page; each id must match a section's `id`.
 */
export default function SectionLinks({ links }: { links: { id: string; label: string }[] }) {
  if (links.length < 2) return null;
  return (
    <nav aria-label="On this page" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-2 whitespace-nowrap text-sm">
        {links.map((l) => (
          <li key={l.id}>
            <a
              href={`#${l.id}`}
              className="inline-block rounded-full border border-line bg-white px-3 py-1 font-medium text-cobalt hover:border-lapis hover:bg-mist"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
