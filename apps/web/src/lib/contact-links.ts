import type { PublicSettings } from '@sch/shared';
import { safeExternalUrl } from '@/lib/safe-url';

export interface ContactLink {
  label: string;
  href: string;
  external: boolean;
}

/** Redes y email cargados en Settings; descarta URLs que no sean http(s). */
export function getContactLinks(settings: PublicSettings): ContactLink[] {
  const links: ContactLink[] = [];
  const socials: [string, string | null][] = [
    ['Instagram', settings.instagramUrl],
    ['GitHub', settings.githubUrl],
    ['LinkedIn', settings.linkedinUrl],
  ];
  for (const [label, url] of socials) {
    const href = safeExternalUrl(url);
    if (href) links.push({ label, href, external: true });
  }
  const email = settings.email?.trim();
  if (email) links.push({ label: email, href: `mailto:${email}`, external: false });
  return links;
}
