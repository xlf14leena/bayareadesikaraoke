import { NextResponse, type NextRequest } from "next/server";
import { PASS_COOKIE, PASS_MS, checkInIsOpen, codeIsValid, makePass } from "@/lib/checkin";
import { prisma } from "@/lib/prisma";

// Where the venue QR code points. Checks the rotating code, leaves a
// short-lived pass cookie so the guest can sign in first if they need to, and
// sends them to the check-in page (which takes the code out of the address bar).
export async function GET(req: NextRequest, { params }: { params: Promise<{ dateId: string }> }) {
  const { dateId } = await params;
  const code = req.nextUrl.searchParams.get("t") ?? "";
  const date = await prisma.eventDate.findUnique({
    where: { id: dateId },
    select: { status: true, startsAt: true, endsAt: true, checkInOpenedAt: true, checkInSecret: true },
  });
  const target = new URL(`/checkin/${encodeURIComponent(dateId)}`, req.nextUrl.origin);
  if (!date) return NextResponse.redirect(target);
  if (!checkInIsOpen(date) || !codeIsValid(dateId, date.checkInSecret!, code)) {
    target.searchParams.set("scan", "expired");
    return NextResponse.redirect(target);
  }
  const res = NextResponse.redirect(target);
  res.cookies.set(PASS_COOKIE, makePass(dateId, date.checkInSecret!), {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/checkin",
    maxAge: PASS_MS / 1000,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
