import { prisma } from "@/lib/prisma";
import { canAdminGroup, getViewer } from "@/lib/roles";

export const dynamic = "force-dynamic";

// A sign-up's payment screenshot. Only the person who uploaded it, that group's
// admins and super users can open it (spec: screenshots are stored privately).
export async function GET(_req: Request, { params }: { params: Promise<{ signUpId: string }> }) {
  const { signUpId } = await params;
  const viewer = await getViewer();
  if (!viewer) return new Response("Sign in to view this screenshot.", { status: 401 });
  const signUp = await prisma.signUp.findUnique({
    where: { id: signUpId },
    select: { userId: true, eventDate: { select: { series: { select: { groupId: true } } } } },
  });
  if (!signUp || (signUp.userId !== viewer.id && !canAdminGroup(viewer, signUp.eventDate.series.groupId))) {
    return new Response("Not found", { status: 404 });
  }
  const shot = await prisma.paymentScreenshot.findUnique({ where: { signUpId } });
  if (!shot) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(shot.bytes), {
    headers: {
      "Content-Type": shot.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
