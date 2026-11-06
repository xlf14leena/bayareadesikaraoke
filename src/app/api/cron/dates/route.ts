import { syncAllSeries } from "@/lib/schedule";
import { settleAll } from "@/lib/signups";
import { fillSongLengths } from "@/lib/youtube";

export const dynamic = "force-dynamic";

// Daily Vercel Cron (vercel.json): keeps recurring events generated 4 weeks ahead,
// expires overdue 24-hour holds (pages also do this whenever a date is opened), and looks up
// the length of any YouTube track not looked up yet (a backfill, and a retry when a lookup failed).
// Vercel sends "Authorization: Bearer $CRON_SECRET" when CRON_SECRET is set.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  await syncAllSeries();
  const settled = await settleAll();
  const songLengths = await fillSongLengths().catch(() => 0);
  return Response.json({ ok: true, settled, songLengths });
}
