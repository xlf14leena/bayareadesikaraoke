import { DEFAULT_BANNER } from "@/lib/banner";

// Edge to edge: breaks out of the centered content column to the full window
// width and sits flush under the header, like the home hero.
const BLEED = "-mx-[calc(50vw-50%)] -mt-6 overflow-hidden";

/**
 * Wide banner image across the full window width. A group's or event's own
 * banner keeps its own shape (height follows the image, starting from the top),
 * since posters often have text at the top and bottom; on very wide screens it
 * is capped at 80% of the window height and cropped from the bottom. The
 * default photo is cropped to a strip from the top and carries its credit.
 */
export default function Banner({ src, isDefault }: { src: string; isDefault: boolean }) {
  if (!isDefault) {
    // Scaled up 2% from the top-left corner and clipped, so a thin pale strip
    // along the right or bottom edge of a poster (common in exported images)
    // is cut off and the banner reaches the window edge.
    return (
      <div className={`${BLEED} bg-royal`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="block h-auto max-h-[80vh] w-full origin-top-left scale-[1.02] object-cover object-top"
        />
      </div>
    );
  }
  return (
    <div className={`relative ${BLEED}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={DEFAULT_BANNER.alt} className="block h-56 w-full object-cover object-top sm:h-80" />
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
