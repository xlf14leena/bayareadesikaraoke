import { DEFAULT_BANNER } from "@/lib/banner";

/** Wide banner image. The default photo carries its credit, like the home hero. */
export default function Banner({ src, isDefault }: { src: string; isDefault: boolean }) {
  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={isDefault ? DEFAULT_BANNER.alt : ""}
        className="h-44 w-full rounded-2xl object-cover sm:h-64"
      />
      {isDefault && (
        <a
          href={DEFAULT_BANNER.href}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-3 bottom-2 text-[11px] text-white/70 [text-shadow:0_1px_2px_rgb(0_0_0/0.6)] hover:text-white"
        >
          {DEFAULT_BANNER.credit}
        </a>
      )}
    </div>
  );
}
