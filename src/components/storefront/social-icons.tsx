import type { SocialNetwork } from "@/modules/content/schema";

/** Simple monochrome brand marks (lucide ships no brand icons). Decorative: links carry the label. */
const PATHS: Record<SocialNetwork, React.ReactNode> = {
  facebook: <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H7.9v3h2.6V21h3Z" fill="currentColor" />,
  instagram: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" />
    </g>
  ),
  youtube: (
    <g>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="currentColor" />
      <path d="m10 9 5 3-5 3V9Z" fill="var(--social-icon-bg, #111)" />
    </g>
  ),
  tiktok: <path d="M15.6 3c.3 2.1 1.6 3.6 3.9 3.9v3c-1.4 0-2.7-.4-3.8-1.1v5.9a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v3.1a2.6 2.6 0 1 0 1.7 2.4V3h2.9Z" fill="currentColor" />,
  linkedin: (
    <g fill="currentColor">
      <rect x="4" y="9" width="3.2" height="11" />
      <circle cx="5.6" cy="5.6" r="1.9" />
      <path d="M10 9h3v1.6c.5-.9 1.7-1.9 3.5-1.9 3.2 0 3.8 2.1 3.8 4.8V20h-3.2v-5.7c0-1.4 0-3.1-1.9-3.1s-2.2 1.5-2.2 3V20H10V9Z" />
    </g>
  ),
  x: <path d="M17.8 3.5h3l-6.6 7.5 7.8 9.5h-6.1l-4.8-5.9-5.4 5.9h-3l7-7.9-7.4-9.1h6.2l4.3 5.4 5-5.4Zm-1 15.2h1.7L7.3 5.2H5.5l11.3 13.5Z" fill="currentColor" />,
};

export const SOCIAL_LABELS: Record<SocialNetwork, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  x: "X",
};

export function SocialIcon({ network, className }: { network: SocialNetwork; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      {PATHS[network]}
    </svg>
  );
}

/** Only networks the owner has filled in are shown; nothing links to a placeholder profile. */
export function SocialLinks({ social, className, itemClassName }: { social: Record<SocialNetwork, string>; className?: string; itemClassName?: string }) {
  const entries = (Object.entries(social) as [SocialNetwork, string][]).filter(([, href]) => href);
  if (entries.length === 0) return null;
  return (
    <ul className={className}>
      {entries.map(([network, href]) => (
        <li key={network}>
          <a href={href} target="_blank" rel="noopener noreferrer" aria-label={SOCIAL_LABELS[network]} className={itemClassName}>
            <SocialIcon network={network} className="size-4" />
          </a>
        </li>
      ))}
    </ul>
  );
}
