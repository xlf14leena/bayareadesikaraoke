import { prisma } from "@/lib/prisma";
import { FormError, optionalUrl } from "@/lib/forms";

// Banner images uploaded from the admin forms are kept in the database, so there is no extra storage service to set up. The
// owner's bannerUrl points at /api/banners/<id>; a pasted link works as before.

const PREFIX = "/api/banners/";
export const MAX_BANNER_BYTES = 4 * 1024 * 1024;
export const BANNER_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** The uploaded image a bannerUrl points at, if it is one of ours. */
function uploadedId(url: string | null | undefined): string | null {
  return url?.startsWith(PREFIX) ? url.slice(PREFIX.length) : null;
}

/** Which picker a form field belongs to: the banner, or a group's thumbnail. */
export type ImageField = "banner" | "thumbnail";

/**
 * The image from a BannerField: a new upload, a pasted link, the uploaded
 * image it already had, or none. Call it after the form's other checks, so a
 * mistake elsewhere doesn't leave an unused upload behind.
 */
export async function bannerFromForm(
  form: FormData,
  current: string | null,
  field: ImageField = "banner",
): Promise<string | null> {
  const file = form.get(`${field}File`);
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BANNER_BYTES) throw new FormError(`That ${field} image is too large. Keep it under 4 MB.`);
    const type = file.type.toLowerCase();
    if (!BANNER_TYPES.includes(type)) throw new FormError(`Upload the ${field} as a JPG, PNG, WebP or GIF image.`);
    const image = await prisma.bannerImage.create({
      data: { contentType: type, bytes: Buffer.from(await file.arrayBuffer()) },
      select: { id: true },
    });
    return PREFIX + image.id;
  }
  const link = optionalUrl(form, `${field}Url`, field === "banner" ? "Banner image link" : "Thumbnail image link");
  if (link) return link;
  // Keeping the uploaded image: only the one this owner already has.
  const keep = String(form.get(`${field}Keep`) ?? "");
  return keep && keep === current ? current : null;
}

/** Deletes an uploaded image the owner no longer uses. */
export async function dropReplacedBanner(before: string | null, after: string | null): Promise<void> {
  const id = uploadedId(before);
  if (!id || before === after) return;
  // Another group, event or date may share it (for example a copied date).
  const where = { bannerUrl: before };
  const [groups, thumbnails, series, dates] = await Promise.all([
    prisma.group.count({ where }),
    prisma.group.count({ where: { thumbnailUrl: before } }),
    prisma.eventSeries.count({ where }),
    prisma.eventDate.count({ where }),
  ]);
  if (groups + thumbnails + series + dates === 0) await prisma.bannerImage.deleteMany({ where: { id } });
}

/** Deletes an image uploaded during a save that then failed. */
export async function dropUnsavedBanner(before: string | null, after: string | null): Promise<void> {
  if (after !== before && uploadedId(after)) await dropReplacedBanner(after, null);
}

/**
 * Reads the banner from the form and runs the save with it. If the save fails
 * the new upload is removed; if it succeeds the image it replaced is.
 */
export async function withBanner(
  form: FormData,
  before: string | null,
  save: (bannerUrl: string | null) => Promise<void>,
  { use = true, field = "banner" }: { use?: boolean; field?: ImageField } = {},
): Promise<void> {
  const after = use ? await bannerFromForm(form, before, field) : null;
  try {
    await save(after);
  } catch (e) {
    await dropUnsavedBanner(before, after);
    throw e;
  }
  await dropReplacedBanner(before, after);
}
