import { prisma } from "@/lib/prisma";

// An uploaded banner image (src/lib/banner-upload.ts). Banners are public like
// the pages that show them. A new upload gets a new id, so they cache forever.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const image = await prisma.bannerImage.findUnique({ where: { id } });
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
