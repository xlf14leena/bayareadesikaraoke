/** A titled group of form fields: a bordered panel with a marigold cream header and a gold edge. */
export default function FormSection({
  title,
  note,
  action,
  children,
}: {
  title: string;
  /** Small grey text after the title, such as "Pacific time". */
  note?: string;
  /** Something on the right of the header, such as a checkbox. */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="min-w-0 overflow-hidden rounded-xl border border-cream-edge bg-white">
      {/* Floating the legend lets it fill the header strip like a normal block. */}
      <legend className="float-left flex w-full flex-wrap items-center justify-between gap-2 border-b border-l-4 border-b-cream-line border-l-gold bg-cream px-4 py-2.5 sm:px-5">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold text-royal">{title}</span>
          {note && <span className="text-xs text-ink-muted">{note}</span>}
        </span>
        {action}
      </legend>
      <div className="clear-both space-y-4 p-4 sm:p-5">{children}</div>
    </fieldset>
  );
}
