// @vitest-environment jsdom
import type { AdminSettings } from '@sch/shared';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_EMAIL, errorResponse, stubAdminApi, type ApiCall } from '@/test/admin-api';
import { settingsFixture } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { BusinessSettingsSection } from './business-settings-form';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// La fixture pública trae un link `javascript:` a propósito; para el formulario hace falta
// una configuración que pase la validación.
const settings: AdminSettings = {
  ...settingsFixture,
  linkedinUrl: 'https://linkedin.com/in/sch',
  bookingWhatsappTemplate: 'Hola {{negocio}}, quiero {{servicio}} a {{precio}}',
};

const putCalls = (calls: ApiCall[]) =>
  calls.filter((c) => c.method === 'PUT' && c.path === '/api/admin/settings');

function setup(extra: (call: ApiCall) => Response | undefined = () => undefined) {
  const api = stubAdminApi({
    session: { email: ADMIN_EMAIL },
    handler: (call) => {
      const custom = extra(call);
      if (custom) return custom;
      if (call.method === 'GET' && call.path === '/api/admin/settings') {
        return Response.json({ data: settings });
      }
      if (call.method === 'PUT' && call.path === '/api/admin/settings') {
        return Response.json({ data: { ...settings, ...(call.body as object) } });
      }
      return undefined;
    },
  });
  renderWithProviders(<BusinessSettingsSection />, { route: '/admin/configuracion' });
  return { ...api, user: userEvent.setup() };
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const saveButton = () =>
  screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement;

async function loaded() {
  await screen.findByDisplayValue('SCH Soluciones');
}

describe('BusinessSettingsSection', () => {
  it('carga los datos actuales y arranca sin cambios', async () => {
    setup();
    await loaded();

    expect(field('Número de WhatsApp').value).toBe('5491122334455');
    expect(field('Instagram').value).toBe('https://instagram.com/sch');
    // Los null de la API se ven como campos vacíos.
    expect(field('GitHub').value).toBe('');
    expect(screen.getByText('Sin cambios')).toBeTruthy();
    expect(saveButton().getAttribute('aria-disabled')).toBe('true');
  });

  it('muestra el error si la configuración no carga', async () => {
    setup((call) =>
      call.method === 'GET' && call.path === '/api/admin/settings'
        ? errorResponse(500, 'INTERNAL_ERROR', 'Error')
        : undefined,
    );

    expect(await screen.findByText('No se pudo cargar la configuración')).toBeTruthy();
  });

  it('guarda con PUT /api/admin/settings y vuelve a "Sin cambios"', async () => {
    const { user, calls } = setup();
    await loaded();

    await user.clear(field('Nombre del negocio'));
    await user.type(field('Nombre del negocio'), 'Taller Pepe');
    expect(screen.getByText('Hay cambios sin guardar')).toBeTruthy();
    await user.click(saveButton());

    await waitFor(() => expect(putCalls(calls)).toHaveLength(1));
    expect(putCalls(calls)[0]?.body).toMatchObject({
      businessName: 'Taller Pepe',
      whatsappNumber: '5491122334455',
      instagramUrl: 'https://instagram.com/sch',
      githubUrl: null,
      aboutText: null,
      email: 'hola@example.com',
      bookingWhatsappTemplate: 'Hola {{negocio}}, quiero {{servicio}} a {{precio}}',
    });
    expect(await screen.findByText('Sin cambios')).toBeTruthy();
    expect(saveButton().getAttribute('aria-disabled')).toBe('true');
  });

  it('guarda el texto "Sobre mí" y normaliza el número de WhatsApp a solo dígitos', async () => {
    const { user, calls } = setup();
    await loaded();

    await user.type(field('Texto de la página de contacto (opcional)'), 'Primer párrafo.');
    await user.clear(field('Número de WhatsApp'));
    await user.type(field('Número de WhatsApp'), '+54 9 11 2233-4455');
    await user.click(saveButton());

    await waitFor(() => expect(putCalls(calls)).toHaveLength(1));
    expect(putCalls(calls)[0]?.body).toMatchObject({
      aboutText: 'Primer párrafo.',
      whatsappNumber: '5491122334455',
    });
  });

  it('"Descartar" vuelve a lo guardado', async () => {
    const { user, calls } = setup();
    await loaded();

    await user.type(field('Nombre del negocio'), ' extra');
    await user.click(screen.getByRole('button', { name: 'Descartar' }));
    // Pide confirmación antes de tirar los cambios.
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Descartar' }));

    expect(field('Nombre del negocio').value).toBe('SCH Soluciones');
    expect(screen.getByText('Sin cambios')).toBeTruthy();
    expect(putCalls(calls)).toHaveLength(0);
  });

  it('no envía si un link no es https y marca el campo', async () => {
    const { user, calls } = setup();
    await loaded();

    await user.clear(field('GitHub'));
    await user.type(field('GitHub'), 'http://github.com/sch');
    await user.click(saveButton());

    expect(await screen.findByText('Ingresá un link completo con https://')).toBeTruthy();
    expect(field('GitHub').getAttribute('aria-invalid')).toBe('true');
    expect(putCalls(calls)).toHaveLength(0);
  });

  it('no envía si el nombre del negocio queda vacío', async () => {
    const { user, calls } = setup();
    await loaded();

    await user.clear(field('Nombre del negocio'));
    await user.click(saveButton());

    expect(await screen.findByText('Ingresá el nombre del negocio')).toBeTruthy();
    expect(putCalls(calls)).toHaveLength(0);
  });

  it('marca en el campo los errores por campo que devuelve la API', async () => {
    const { user } = setup((call) =>
      call.method === 'PUT'
        ? errorResponse(400, 'VALIDATION_ERROR', 'Datos inválidos', [
            { path: ['email'], message: 'Email rechazado por la API' },
          ])
        : undefined,
    );
    await loaded();

    await user.type(field('Horarios (opcional)'), ' (feriados cerrado)');
    await user.click(saveButton());

    expect(await screen.findByText('Email rechazado por la API')).toBeTruthy();
    expect(field('Email (opcional)').getAttribute('aria-invalid')).toBe('true');
  });

  describe('aviso de número de WhatsApp', () => {
    it('avisa si es un celular argentino mal armado (541122334455, sin el 9)', async () => {
      const { user } = setup();
      await loaded();
      expect(screen.getByRole('status').textContent).toBe('');

      await user.clear(field('Número de WhatsApp'));
      await user.type(field('Número de WhatsApp'), '541122334455');

      await waitFor(() =>
        expect(screen.getByRole('status').textContent).toContain('después del 54 va un 9'),
      );
    });

    it('avisa si empieza con 0', async () => {
      const { user } = setup();
      await loaded();

      await user.clear(field('Número de WhatsApp'));
      await user.type(field('Número de WhatsApp'), '01122334455');

      await waitFor(() =>
        expect(screen.getByRole('status').textContent).toContain('No va el 0 inicial'),
      );
    });

    it('no avisa con un número bien armado, aunque tenga +, espacios y guiones', async () => {
      const { user } = setup();
      await loaded();

      await user.clear(field('Número de WhatsApp'));
      await user.type(field('Número de WhatsApp'), '+54 9 11 2233-4455');

      expect(screen.getByRole('status').textContent).toBe('');
    });

    it('el aviso no bloquea el guardado', async () => {
      const { user, calls } = setup();
      await loaded();

      await user.clear(field('Número de WhatsApp'));
      await user.type(field('Número de WhatsApp'), '541122334455');
      await user.click(saveButton());

      await waitFor(() => expect(putCalls(calls)).toHaveLength(1));
      expect(putCalls(calls)[0]?.body).toMatchObject({ whatsappNumber: '541122334455' });
    });
  });

  describe('plantillas de WhatsApp', () => {
    const bookingPreview = () => screen.getByTestId('settings-booking-template-preview');
    const groups = () => screen.getAllByRole('group', { name: 'Insertar variable' });
    const bookingField = () => screen.getByLabelText('"Reservar turno"') as HTMLTextAreaElement;

    it('la vista previa usa valores de ejemplo y el nombre del negocio escrito', async () => {
      const { user } = setup();
      await loaded();

      expect(bookingPreview().textContent).toMatch(
        /^Hola SCH Soluciones, quiero Instalación de Windows a \$\s25\.000$/,
      );

      await user.clear(field('Nombre del negocio'));
      await user.type(field('Nombre del negocio'), 'Taller Pepe');

      expect(bookingPreview().textContent).toContain('Hola Taller Pepe,');
    });

    it('la vista previa se actualiza al editar la plantilla', async () => {
      const { user } = setup();
      await loaded();

      await user.clear(bookingField());
      await user.click(bookingField());
      await user.paste('Buenas, consulto por {{servicio}}');

      expect(bookingPreview().textContent).toBe('Buenas, consulto por Instalación de Windows');
    });

    it('los chips insertan la variable en la posición del cursor', async () => {
      const { user } = setup();
      await loaded();

      await user.clear(bookingField());
      await user.type(bookingField(), 'Hola ');
      await user.click(within(groups()[0]!).getByRole('button', { name: 'Insertar {{servicio}}' }));

      expect(bookingField().value).toBe('Hola {{servicio}}');
      expect(bookingPreview().textContent).toBe('Hola Instalación de Windows');

      await user.click(within(groups()[0]!).getByRole('button', { name: 'Insertar {{precio}}' }));
      expect(bookingField().value).toContain('{{precio}}');
      expect(bookingPreview().textContent).toMatch(/\$\s25\.000/);
    });

    it('con la plantilla vacía la vista previa usa la de fábrica y lo indica', async () => {
      const { user } = setup();
      await loaded();

      await user.clear(bookingField());

      expect(
        screen.getAllByText('Vista previa (vacía: se usa el de fábrica)').length,
      ).toBeGreaterThan(0);
      expect(bookingPreview().textContent).toBe(
        '¡Hola! 👋 Vi en tu página el servicio "Instalación de Windows" y quisiera reservar un turno 📅.',
      );
    });

    it('la plantilla general solo ofrece la variable negocio', async () => {
      setup();
      await loaded();

      expect(within(groups()[0]!).getAllByRole('button')).toHaveLength(3);
      expect(within(groups()[1]!).getAllByRole('button')).toHaveLength(3);
      const general = within(groups()[2]!).getAllByRole('button');
      expect(general).toHaveLength(1);
      expect(general[0]?.textContent).toBe('{{negocio}}');
    });

    it('guarda la plantilla editada con los chips', async () => {
      const { user, calls } = setup();
      await loaded();

      await user.clear(bookingField());
      await user.click(within(groups()[0]!).getByRole('button', { name: 'Insertar {{negocio}}' }));
      await user.click(saveButton());

      await waitFor(() => expect(putCalls(calls)).toHaveLength(1));
      expect(putCalls(calls)[0]?.body).toMatchObject({ bookingWhatsappTemplate: '{{negocio}}' });
    });
  });
});
