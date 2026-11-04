import { DEFAULT_BANNER } from "@/lib/banner";

/**
 * Wide banner image. A group's or event's own banner is shown whole, scaled
 * down to fit the strip, since posters often have text at the top and bottom;
 * a blurred copy fills the space at the sides. The default photo is cropped to
 * the strip and carries its credit, like the home hero.
 */
export default function Banner({ src, isDefault }: { src: string; isDefault: boolean }) {
  if (!isDefault) {
    return (
      <div className="relative h-48 w-full overflow-hidden rounded-2xl bg-royal sm:h-72">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="relative h-full w-full object-contain" />
      </div>
    );
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
