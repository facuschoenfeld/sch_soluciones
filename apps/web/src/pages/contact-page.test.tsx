// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { publicQueryKeys } from '@/lib/public-api';
import { settingsFixture } from '@/test/fixtures';
import { createTestQueryClient, renderWithProviders } from '@/test/render';
import { ContactPage } from './contact-page';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setupWithSettings() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(publicQueryKeys.settings, settingsFixture);
  return renderWithProviders(<ContactPage />, { route: '/contacto', queryClient });
}

describe('ContactPage', () => {
  it('muestra horarios y zona de atención', () => {
    setupWithSettings();

    expect(screen.getByRole('heading', { level: 1, name: 'Contacto' })).toBeTruthy();
    expect(screen.getByText('Horarios')).toBeTruthy();
    expect(screen.getByText('Lunes a viernes de 9 a 18 h')).toBeTruthy();
    expect(screen.getByText('Zona de atención')).toBeTruthy();
    expect(screen.getByText('Zona oeste')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Escribime por WhatsApp' })).toBeTruthy();
  });

  it('muestra solo los links con URL http(s) y el email', () => {
    setupWithSettings();

    const instagram = screen.getByRole('link', { name: /Instagram/ });
    expect(instagram.getAttribute('href')).toBe('https://instagram.com/sch');
    expect(instagram.getAttribute('target')).toBe('_blank');
    expect(instagram.getAttribute('rel')).toContain('noopener');

    // githubUrl es null y linkedinUrl es `javascript:`: ninguno debe aparecer.
    expect(screen.queryByRole('link', { name: /GitHub/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /LinkedIn/ })).toBeNull();
    expect(document.querySelector('a[href^="javascript:"]')).toBeNull();

    const email = screen.getByRole('link', { name: 'hola@example.com' });
    expect(email.getAttribute('href')).toBe('mailto:hola@example.com');
    expect(email.getAttribute('target')).toBeNull();
  });

  it('omite horarios y zona si no están cargados', () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(publicQueryKeys.settings, {
      ...settingsFixture,
      businessHours: null,
      serviceArea: null,
    });
    renderWithProviders(<ContactPage />, { route: '/contacto', queryClient });

    expect(screen.queryByText('Horarios')).toBeNull();
    expect(screen.queryByText('Zona de atención')).toBeNull();
  });

  it('muestra el estado de error con opción de reintentar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ error: { code: 'INTERNAL_ERROR', message: 'Error' } }, { status: 500 }),
      ),
    );
    renderWithProviders(<ContactPage />, { route: '/contacto' });

    expect(await screen.findByText('No se pudo cargar la información')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
    expect(screen.queryByText('Horarios')).toBeNull();
  });
});
