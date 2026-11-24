import { MoonIcon } from '@animateicons/react/lucide/moon-icon';
import { SunIcon } from '@animateicons/react/lucide/sun-icon';
import { useEffect, useState } from 'react';
import { AnimatedIcon } from '@/components/icons/animated-icon';
import { Button } from '@/components/ui/button';
import { applyTheme, getCurrentTheme, getStoredTheme, saveTheme, type Theme } from '@/lib/theme';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getCurrentTheme);

  // Mientras el visitante no elija un tema, se sigue la preferencia del sistema.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      if (getStoredTheme()) return;
      const next: Theme = event.matches ? 'dark' : 'light';
      applyTheme(next);
      setTheme(next);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    saveTheme(next);
    setTheme(next);
  };

  const label = theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro';

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-11"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      <AnimatedIcon icon={theme === 'dark' ? SunIcon : MoonIcon} />
    </Button>
  );
}
