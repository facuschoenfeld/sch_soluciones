// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ABOUT_TEXT } from '@/lib/about-text';
import { publicQueryKeys } from '@/lib/public-api';
import { settingsFixture } from '@/test/fixtures';
import { createTestQueryClient, renderWithProviders } from '@/test/render';
import { ContactPage } from './contact-page';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderWithAbout(aboutText: string | null) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(publicQueryKeys.settings, { ...settingsFixture, aboutText });
  renderWithProviders(<ContactPage />, { route: '/contacto', queryClient });
  return screen.getByRole('region', { name: 'Sobre mí' });
}

describe('ContactPage ("Sobre mí" con aboutText)', () => {
  it('muestra el texto cargado, un párrafo por bloque separado por línea en blanco', () => {
    const section = renderWithAbout('Primer párrafo.\n\nSegundo párrafo.\n  \n\nTercero.');

    const paragraphs = Array.from(section.querySelectorAll('p')).map((p) => p.textContent);
    // El primero es la frase corta (tagline).
    expect(paragraphs).toEqual([
      'Desarrollo y servicio técnico',
      'Primer párrafo.',
      'Segundo párrafo.',
      'Tercero.',
    ]);
    expect(within(section).queryByText(DEFAULT_ABOUT_TEXT)).toBeNull();
  });

  it('mantiene los saltos de línea simples dentro de un párrafo', () => {
    const section = renderWithAbout('Línea uno\nLínea dos');

    const paragraph = within(section).getByText(/Línea uno/);
    expect(paragraph.textContent).toBe('Línea uno\nLínea dos');
    expect(paragraph.className).toContain('whitespace-pre-line');
  });

  it('usa el texto genérico si aboutText es null', () => {
    const section = renderWithAbout(null);

    expect(within(section).getByText(DEFAULT_ABOUT_TEXT)).toBeTruthy();
  });

  it('usa el texto genérico si aboutText es solo espacios', () => {
    const section = renderWithAbout('  \n\n  ');

    expect(within(section).getByText(DEFAULT_ABOUT_TEXT)).toBeTruthy();
  });

  it('no interpreta HTML del texto (se muestra como texto plano)', () => {
    const section = renderWithAbout('<b>negrita</b> <script>alert(1)</script>');

    expect(section.querySelector('b')).toBeNull();
    expect(section.querySelector('script')).toBeNull();
    expect(within(section).getByText(/<b>negrita<\/b>/)).toBeTruthy();
  });
});
