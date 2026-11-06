import { getViewer } from "@/lib/roles";
import { youtubeVideoId } from "@/lib/signups";
import { fetchDuration } from "@/lib/youtube";

export const dynamic = "force-dynamic";

// The length of a YouTube track, for the song form's preview while a singer types a link.
// Signed-in people only, so the API quota isn't open to anyone. ?url=<YouTube link>
// Answers { seconds } (null when YouTube has no length for it), or 404 when it can't be looked up.
export async function GET(request: Request) {
  if (!(await getViewer())) return new Response("Sign in first.", { status: 401 });
  const id = youtubeVideoId(new URL(request.url).searchParams.get("url") ?? "");
  if (!id) return Response.json({ error: "Not a YouTube link" }, { status: 400 });
  const seconds = await fetchDuration(id);
  if (seconds === undefined) return Response.json({ error: "Couldn't look it up" }, { status: 404 });
  return Response.json({ seconds }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
