import type { Group } from "@prisma/client";

type Links = Pick<Group, "name" | "websiteUrl" | "facebookUrl" | "instagramUrl">;

/** The group's website, Facebook and Instagram, as round icon links. Nothing when none are set. */
export default function GroupLinks({ group, className = "mt-3" }: { group: Links; className?: string }) {
  const links = [
    { href: group.websiteUrl, label: "Website", icon: <GlobeIcon /> },
    { href: group.facebookUrl, label: "Facebook", icon: <FacebookIcon /> },
    { href: group.instagramUrl, label: "Instagram", icon: <InstagramIcon /> },
  ].filter((l): l is typeof l & { href: string } => !!l.href);
  if (links.length === 0) return null;

  return (
    <ul className={`flex flex-wrap gap-2 ${className}`} aria-label={`${group.name} online`}>
      {links.map((l) => (
        <li key={l.label}>
          <a
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${group.name} ${l.label}`}
            title={l.label}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-royal hover:border-royal"
          >
            {l.icon}
          </a>
        </li>
      ))}
    </ul>
  );
}

const iconProps = { width: 20, height: 20, viewBox: "0 0 24 24", "aria-hidden": true } as const;

function GlobeIcon() {
  return (
    <svg {...iconProps} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg {...iconProps} fill="#1877F2">
      <path d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3 1.79-4.67 4.53-4.67 1.31 0 2.69.24 2.69.24v2.95h-1.52c-1.49 0-1.95.93-1.95 1.88V12h3.33l-.53 3.47h-2.8v8.38A12 12 0 0 0 24 12z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg {...iconProps} fill="none" stroke="#C13584" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="#C13584" />
    </svg>
  );
}
