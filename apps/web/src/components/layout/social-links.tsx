import { ExternalLinkIcon } from '@animateicons/react/lucide/external-link-icon';
import { MailIcon } from '@animateicons/react/lucide/mail-icon';
import type { PublicSettings } from '@sch/shared';
import { AnimatedIcon } from '@/components/icons/animated-icon';
import { getContactLinks } from '@/lib/contact-links';
import { cn } from '@/lib/utils';

// lucide ya no incluye logos de marcas: se muestran con texto y un ícono genérico.

export function SocialLinks({
  settings,
  className,
}: {
  settings: PublicSettings;
  className?: string;
}) {
  const links = getContactLinks(settings);
  if (links.length === 0) return null;

  return (
    <ul className={cn('flex flex-col', className)}>
      {links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="inline-flex min-h-10 items-center gap-2 rounded-sm text-sm text-muted-foreground underline-offset-4 focus-ring hover:text-foreground hover:underline"
          >
            {link.external ? (
              <AnimatedIcon icon={ExternalLinkIcon} />
            ) : (
              <AnimatedIcon icon={MailIcon} />
            )}
            {link.label}
            {link.external && <span className="sr-only"> (se abre en una pestaña nueva)</span>}
          </a>
        </li>
      ))}
    </ul>
  );
}
