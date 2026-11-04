import { DEFAULT_BANNER } from "@/lib/banner";

/**
 * Wide banner image. A group's or event's own banner is shown whole at its own
 * shape (full width, height follows the image), since posters often have text
 * at the top and bottom. The default photo is cropped to a strip and carries
 * its credit, like the home hero.
 */
export default function Banner({ src, isDefault }: { src: string; isDefault: boolean }) {
  if (!isDefault) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className="h-auto w-full rounded-2xl" />;
  }
  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={DEFAULT_BANNER.alt} className="h-44 w-full rounded-2xl object-cover sm:h-64" />
      <a
        href={DEFAULT_BANNER.href}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute right-3 bottom-2 text-[11px] text-white/70 [text-shadow:0_1px_2px_rgb(0_0_0/0.6)] hover:text-white"
      >
        {DEFAULT_BANNER.credit}
      </a>
    </div>
  );
}
