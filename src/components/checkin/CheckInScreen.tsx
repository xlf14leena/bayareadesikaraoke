"use client";

import { useEffect, useState } from "react";

type Feed = {
  open: boolean;
  svg?: string;
  nextAt?: number;
  checkedIn: number;
  total: number;
  recent: { id: string; name: string; at: string }[];
};

const POLL_MS = 3000;

const clock = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );

/**
 * The venue check-in screen: a QR code that changes every 30 seconds, plus
 * who has just checked in. Keeps the screen awake where the browser allows.
 */
export default function CheckInScreen({ dateId, backHref }: { dateId: string; backHref: string }) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const res = await fetch(`/api/checkin/${dateId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const next: Feed = await res.json();
        if (!stop) {
          setFeed(next);
          setOffline(false);
        }
      } catch {
        if (!stop) setOffline(true);
      }
      if (!stop) timer = setTimeout(load, POLL_MS);
    };
    load();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      stop = true;
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, [dateId]);

  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const wake = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<typeof lock> } };
        lock = (await nav.wakeLock?.request("screen")) ?? null;
      } catch {
        // Not supported or not allowed; the screen may dim.
      }
    };
    wake();
    const onVisible = () => document.visibilityState === "visible" && wake();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, []);

  if (!feed) return <p className="py-20 text-center text-ink-muted">Loading the check-in code…</p>;

  const secondsLeft = feed.nextAt ? Math.max(0, Math.ceil((feed.nextAt - now) / 1000)) : 0;

  return (
    <div className="space-y-6 text-center">
      {feed.open && feed.svg ? (
        <>
          <h1 className="font-display text-3xl text-royal sm:text-4xl">Scan to check in</h1>
          <div
            className="mx-auto aspect-square w-full max-w-[min(80vw,60vh)] rounded-xl bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
            // The SVG is generated on our server from our own check-in URL.
            dangerouslySetInnerHTML={{ __html: feed.svg }}
          />
          <p className="text-ink-muted">
            Open your phone&apos;s camera and point it at the code. It changes in {secondsLeft}s.
          </p>
        </>
      ) : (
        <div className="space-y-2 py-10">
          <h1 className="font-display text-3xl text-royal">Check-in is closed</h1>
          <p className="text-ink-muted">
            Open check-in from the{" "}
            <a href={backHref} className="font-medium text-cobalt hover:underline">
              date&apos;s admin page
            </a>
            .
          </p>
        </div>
      )}
      {offline && (
        <p role="alert" className="text-sm font-medium text-red-700">
          Can&apos;t reach the server. The code will refresh when the connection is back.
        </p>
      )}
      <div className="mx-auto max-w-md space-y-2">
        <p className="text-lg font-semibold">
          {feed.checkedIn} of {feed.total} checked in
        </p>
        {feed.recent.length > 0 && (
          <ul className="space-y-1 text-ink-muted">
            {feed.recent.map((r) => (
              <li key={r.id}>
                <span className="font-medium text-ink">{r.name}</span> · {clock(r.at)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
