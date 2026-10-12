"use client";

import { useEffect, useState } from "react";
import { secondaryButton } from "@/components/ui";

/** Shows a site link in full and copies it on click. */
export default function CopyLink({ path }: { path: string }) {
  const [url, setUrl] = useState(path);
  const [copied, setCopied] = useState(false);
  useEffect(() => setUrl(window.location.origin + path), [path]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-mist px-3 py-2 text-sm">{url}</code>
      <button
        type="button"
        className={secondaryButton}
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
