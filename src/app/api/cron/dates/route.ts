import { syncAllSeries } from "@/lib/schedule";

export const dynamic = "force-dynamic";

// Daily Vercel Cron (vercel.json): keeps recurring events generated 8 weeks ahead.
// Vercel sends "Authorization: Bearer $CRON_SECRET" when CRON_SECRET is set.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  await syncAllSeries();
  return Response.json({ ok: true });
}
