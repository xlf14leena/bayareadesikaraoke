// Fallback banner for events and groups that don't set their own image.
// Free to use under the Unsplash License (https://unsplash.com/license); credited on the page anyway.
export const DEFAULT_BANNER = {
  src: "https://images.unsplash.com/photo-1774377769229-e8a8362fa2c3?auto=format&fit=crop&w=1400&q=70",
  alt: "A man and a woman in Indian clothes singing on stage",
  credit: "Photo: Tanmay Abhay Mahajan / Unsplash",
  href: "https://unsplash.com/photos/man-and-woman-singing-on-stage-Z5TeCfzv0iI",
};

/** The first banner that is set, or the default singing photo. */
export function bannerFor(...urls: (string | null | undefined)[]) {
  const src = urls.find((u) => u);
  return src ? { src, isDefault: false } : { src: DEFAULT_BANNER.src, isDefault: true };
}
