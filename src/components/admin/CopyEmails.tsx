"use client";

import { useState } from "react";
import { secondaryButton } from "@/components/ui";

/** Copies a list of email addresses, comma separated, ready to paste into an email's To or Bcc. */
export default function CopyEmails({ emails }: { emails: string[] }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={secondaryButton}
      disabled={emails.length === 0}
      onClick={async () => {
        await navigator.clipboard.writeText(emails.join(", "));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copied" : `Copy all ${emails.length} emails`}
    </button>
  );
}
