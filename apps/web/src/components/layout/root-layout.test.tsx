// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publicQueryKeys } from '@/lib/public-api';
import { settingsFixture } from '@/test/fixtures';
import { createTestQueryClient, renderWithProviders } from '@/test/render';
import { RootLayout } from './root-layout';

// jsdom no trae window.matchMedia (lo usa ThemeToggle).
function stubMatchMedia() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

beforeEach(() => {
  stubMatchMedia();
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

function setup(businessName = settingsFixture.businessName) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(publicQueryKeys.settings, { ...settingsFixture, businessName });
  const user = userEvent.setup();
  renderWithProviders(<RootLayout />, { queryClient });
  return { user };
}

describe('RootLayout', () => {
  it('el botón flotante de WhatsApp abre el diálogo con la plantilla general', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Escribir por WhatsApp' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Mensaje')).toHaveProperty(
      'value',
      settingsFixture.generalWhatsappTemplate,
    );
    // Sin servicio no hay opciones rápidas.
    expect(within(dialog).queryByRole('radio')).toBeNull();
  });

  it('el toggle de tema alterna la clase dark en <html> y guarda la preferencia', async () => {
    const { user } = setup();
    const root = document.documentElement;

    await user.click(screen.getByRole('button', { name: 'Activar modo oscuro' }));
    expect(root.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'Activar modo claro' }));
    expect(root.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it.each([
    ['SCH Soluciones', 'SCH'],
    ['SCH', 'SCH'],
    ['Schmidt Reparaciones', null],
    ['Taller Pepe', null],
  ])('el logo del header con el nombre "%s" resalta %s', (businessName, highlighted) => {
    setup(businessName);

    const logo = screen.getByRole('link', { name: businessName });
    expect(logo.textContent).toBe(businessName);
    expect(logo.querySelector('.brand-reveal')?.textContent ?? null).toBe(highlighted);
  });

  it('arranca en modo oscuro si <html> ya tiene la clase dark', () => {
    document.documentElement.classList.add('dark');
    setup();

    expect(screen.getByRole('button', { name: 'Activar modo claro' })).toBeTruthy();
  });
});
