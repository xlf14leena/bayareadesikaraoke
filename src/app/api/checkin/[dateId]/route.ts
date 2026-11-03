import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import { CAN_CHECK_IN, checkInIsOpen, currentCode, scanPath } from "@/lib/checkin";
import { prisma } from "@/lib/prisma";
import { canAdminGroup, getViewer } from "@/lib/roles";

// Feeds the venue check-in screen (/admin/dates/<id>/checkin): the current QR
// code and the latest check-ins. Admins of the date's group only.
export async function GET(req: NextRequest, { params }: { params: Promise<{ dateId: string }> }) {
  const { dateId } = await params;
  const date = await prisma.eventDate.findUnique({
    where: { id: dateId },
    include: { series: { select: { groupId: true } } },
  });
  const viewer = await getViewer();
  if (!date || !canAdminGroup(viewer, date.series.groupId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const [total, checkedIn, recent] = await Promise.all([
    prisma.signUp.count({ where: { eventDateId: dateId, status: { in: CAN_CHECK_IN } } }),
    prisma.signUp.count({ where: { eventDateId: dateId, status: { in: CAN_CHECK_IN }, checkedInAt: { not: null } } }),
    prisma.signUp.findMany({
      where: { eventDateId: dateId, status: { in: CAN_CHECK_IN }, checkedInAt: { not: null } },
      orderBy: { checkedInAt: "desc" },
      take: 5,
      select: { id: true, displayName: true, checkedInAt: true },
    }),
  ]);
  const base = { checkedIn, total, recent: recent.map((r) => ({ id: r.id, name: r.displayName, at: r.checkedInAt })) };
  if (!checkInIsOpen(date)) {
    return NextResponse.json({ open: false, ...base }, { headers: { "Cache-Control": "no-store" } });
  }
  const { code, nextAt } = currentCode(dateId, date.checkInSecret!);
  const url = new URL(scanPath(dateId, code), req.nextUrl.origin).toString();
  const svg = await QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
  return NextResponse.json({ open: true, svg, nextAt, ...base }, { headers: { "Cache-Control": "no-store" } });
}
