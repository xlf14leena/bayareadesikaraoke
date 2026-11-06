import type { GroupThumbnail } from "@/lib/group-thumbnail";

/** A group's square thumbnail: its picture filled edge to edge, or its initials tile. */
export default function GroupThumb({
  thumb,
  className = "h-16 w-16",
  text = "text-2xl",
}: {
  thumb: GroupThumbnail;
  className?: string;
  /** Size of the initials. */
  text?: string;
}) {
  if (thumb.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={thumb.src} alt="" className={`${className} object-cover`} />;
  }
  return (
    <span aria-hidden className={`${className} ${thumb.tile} flex items-center justify-center font-display leading-none ${text}`}>
      {thumb.initials}
    </span>
  );
}
