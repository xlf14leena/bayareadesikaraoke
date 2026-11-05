import { syncAllSeries } from "@/lib/schedule";
import { settleAll } from "@/lib/signups";

export const dynamic = "force-dynamic";

// Daily Vercel Cron (vercel.json): keeps recurring events generated 5 weeks ahead,
// and expires overdue 24-hour holds (pages also do this whenever a date is opened).
// Vercel sends "Authorization: Bearer $CRON_SECRET" when CRON_SECRET is set.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  await syncAllSeries();
  const settled = await settleAll();
  return Response.json({ ok: true, settled });
}
