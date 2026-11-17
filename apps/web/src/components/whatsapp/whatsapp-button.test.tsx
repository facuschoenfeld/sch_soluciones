// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { publicQueryKeys } from '@/lib/public-api';
import { createTestQueryClient, renderWithProviders } from '@/test/render';
import { settingsFixture, windowsService } from '@/test/fixtures';
import { WhatsappButton } from './whatsapp-button';

afterEach(cleanup);

function setup(ui: ReactElement, settings = settingsFixture) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(publicQueryKeys.settings, settings);
  const user = userEvent.setup();
  renderWithProviders(ui, { queryClient });
  return { user };
}

/** Texto final del link de WhatsApp, decodificado. */
function sentText(link: HTMLElement): string {
  const url = new URL(link.getAttribute('href') ?? '');
  expect(url.origin + url.pathname).toBe('https://wa.me/5491122334455');
  return url.searchParams.get('text') ?? '';
}

describe('WhatsappButton', () => {
  it('abre el diálogo con la plantilla de reserva y el servicio insertado', async () => {
    const { user } = setup(<WhatsappButton service={windowsService}>Consultar</WhatsappButton>);

    await user.click(screen.getByRole('button', { name: 'Consultar' }));

    const dialog = await screen.findByRole('dialog');
    const textarea = within(dialog).getByLabelText('Mensaje');
    expect(textarea).toHaveProperty(
      'value',
      '¡Hola! 👋 Vi en tu página el servicio "Instalación de Windows" y quisiera reservar un turno 📅.',
    );
    expect(within(dialog).getByRole('radio', { name: /Reservar turno/ })).toHaveProperty(
      'checked',
      true,
    );
  });

  it('las opciones rápidas cambian el texto base', async () => {
    const { user } = setup(<WhatsappButton service={windowsService}>Consultar</WhatsappButton>);
    await user.click(screen.getByRole('button', { name: 'Consultar' }));
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('radio', { name: /Hacer una consulta/ }));

    const value = (within(dialog).getByLabelText('Mensaje') as HTMLTextAreaElement).value;
    expect(value).toContain('tengo una consulta al respecto');
    expect(value).toContain('"Instalación de Windows"');
    // Sin ediciones previas no hay nada que deshacer.
    expect(within(dialog).queryByRole('button', { name: 'Deshacer' })).toBeNull();
  });

  it('si el texto estaba editado, cambiar de opción permite deshacer el reemplazo', async () => {
    const { user } = setup(<WhatsappButton service={windowsService}>Consultar</WhatsappButton>);
    await user.click(screen.getByRole('button', { name: 'Consultar' }));
    const dialog = await screen.findByRole('dialog');
    const textarea = within(dialog).getByLabelText('Mensaje') as HTMLTextAreaElement;

    await user.clear(textarea);
    await user.type(textarea, 'Mi texto');
    await user.click(within(dialog).getByRole('radio', { name: /Hacer una consulta/ }));
    expect(textarea.value).toContain('tengo una consulta');

    await user.click(within(dialog).getByRole('button', { name: 'Deshacer' }));
    expect(textarea.value).toBe('Mi texto');
    expect(document.activeElement).toBe(textarea);
  });

  it('cambiar de opción dos veces no pierde el texto editado', async () => {
    const { user } = setup(<WhatsappButton service={windowsService}>Consultar</WhatsappButton>);
    await user.click(screen.getByRole('button', { name: 'Consultar' }));
    const dialog = await screen.findByRole('dialog');
    const textarea = within(dialog).getByLabelText('Mensaje') as HTMLTextAreaElement;

    await user.clear(textarea);
    await user.type(textarea, 'Mi texto');
    await user.click(within(dialog).getByRole('radio', { name: /Hacer una consulta/ }));
    await user.click(within(dialog).getByRole('radio', { name: /Reservar turno/ }));

    await user.click(within(dialog).getByRole('button', { name: 'Deshacer' }));
    expect(textarea.value).toBe('Mi texto');
  });

  it('el link refleja las ediciones con tildes, saltos de línea y emojis bien codificados', async () => {
    const { user } = setup(<WhatsappButton service={windowsService}>Consultar</WhatsappButton>);
    await user.click(screen.getByRole('button', { name: 'Consultar' }));
    const dialog = await screen.findByRole('dialog');
    const textarea = within(dialog).getByLabelText('Mensaje');

    await user.clear(textarea);
    await user.type(textarea, 'Hola, ¿podés mañana?{Enter}');
    // Pegado: user.type separaría el emoji (par sustituto) en dos teclas.
    await user.paste('Mi notebook no enciende 🔧');

    const link = within(dialog).getByRole('link', { name: /Abrir WhatsApp/ });
    expect(sentText(link)).toBe('Hola, ¿podés mañana?\nMi notebook no enciende 🔧');
    expect(link.getAttribute('href')).toContain('%0A');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('deshabilita el envío si el mensaje queda vacío', async () => {
    const { user } = setup(<WhatsappButton service={windowsService}>Consultar</WhatsappButton>);
    await user.click(screen.getByRole('button', { name: 'Consultar' }));
    const dialog = await screen.findByRole('dialog');

    await user.clear(within(dialog).getByLabelText('Mensaje'));
    await user.type(within(dialog).getByLabelText('Mensaje'), '   ');

    expect(within(dialog).queryByRole('link', { name: /Abrir WhatsApp/ })).toBeNull();
    expect(within(dialog).getByRole('button', { name: /Abrir WhatsApp/ })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('sin servicio usa la plantilla general y no muestra las opciones rápidas', async () => {
    const { user } = setup(<WhatsappButton>Escribime</WhatsappButton>);
    await user.click(screen.getByRole('button', { name: 'Escribime' }));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).queryByRole('radio')).toBeNull();
    const link = within(dialog).getByRole('link', { name: /Abrir WhatsApp/ });
    expect(sentText(link)).toBe(settingsFixture.generalWhatsappTemplate);
  });

  it('cada apertura vuelve a la plantilla (descarta ediciones de la vez anterior)', async () => {
    const { user } = setup(<WhatsappButton service={windowsService}>Consultar</WhatsappButton>);
    await user.click(screen.getByRole('button', { name: 'Consultar' }));
    let dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Mensaje'), ' extra');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await user.click(screen.getByRole('button', { name: 'Consultar' }));
    dialog = await screen.findByRole('dialog');
    expect((within(dialog).getByLabelText('Mensaje') as HTMLTextAreaElement).value).not.toContain(
      'extra',
    );
  });

  it('avisa si el número de WhatsApp no es válido y no arma el link', async () => {
    const { user } = setup(<WhatsappButton>Escribime</WhatsappButton>, {
      ...settingsFixture,
      whatsappNumber: '',
    });
    await user.click(screen.getByRole('button', { name: 'Escribime' }));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByRole('alert').textContent).toContain('no está configurado');
    expect(within(dialog).queryByRole('link', { name: /Abrir WhatsApp/ })).toBeNull();
  });
});
