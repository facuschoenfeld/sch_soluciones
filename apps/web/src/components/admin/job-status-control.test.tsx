// @vitest-environment jsdom
import type { AdminJob } from '@sch/shared';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Toaster } from '@/components/admin/toaster';
import { ADMIN_EMAIL, errorResponse, stubAdminApi, type ApiCall } from '@/test/admin-api';
import { makeJob } from '@/test/admin-fixtures';
import { renderWithProviders } from '@/test/render';
import { JobStatusControl } from './job-status-control';

afterEach(() => {
  cleanup();
  act(() => toast.dismiss());
  vi.unstubAllGlobals();
});

// Sonner captura el puntero al tocar un toast; jsdom no lo implementa.
const originalSetPointerCapture = Element.prototype.setPointerCapture;
beforeAll(() => {
  Element.prototype.setPointerCapture = () => {};
});
afterAll(() => {
  if (originalSetPointerCapture) {
    Element.prototype.setPointerCapture = originalSetPointerCapture;
  } else {
    Reflect.deleteProperty(Element.prototype, 'setPointerCapture');
  }
});

const patches = (calls: ApiCall[]) =>
  calls.filter((c) => c.method === 'PATCH' && c.path === '/api/admin/jobs/1');

function setup(job: AdminJob, extra: (call: ApiCall) => Response | undefined = () => undefined) {
  const api = stubAdminApi({
    session: { email: ADMIN_EMAIL },
    handler: (call) => {
      const custom = extra(call);
      if (custom) return custom;
      if (call.method === 'PATCH' && call.path === '/api/admin/jobs/1') {
        return Response.json({ data: { ...job, ...(call.body as object) } });
      }
      return undefined;
    },
  });
  const view = renderWithProviders(<JobStatusControl job={job} />);
  render(<Toaster />);
  return { ...api, ...view, user: userEvent.setup() };
}

const chooseAndApply = async (user: ReturnType<typeof userEvent.setup>, option: string) => {
  await user.selectOptions(screen.getByLabelText('Cambiar a otro estado'), option);
  await user.click(screen.getByRole('button', { name: 'Aplicar' }));
};

describe('JobStatusControl (avanzar)', () => {
  it('"Pasar a <siguiente>" hace PATCH { status } sin pedir confirmación', async () => {
    const { user, calls } = setup(makeJob({ id: 1, status: 'QUOTED' }));

    await user.click(screen.getByRole('button', { name: /Pasar a Agendado/ }));

    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]?.body).toEqual({ status: 'SCHEDULED' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(await screen.findByText('Estado: Agendado')).toBeTruthy();
  });

  it('el botón principal sigue el flujo: Terminado -> Entregado', async () => {
    const { user, calls } = setup(makeJob({ id: 1, status: 'COMPLETED' }));

    await user.click(screen.getByRole('button', { name: /Pasar a Entregado/ }));

    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]?.body).toEqual({ status: 'DELIVERED' });
  });

  it.each(['DELIVERED', 'CANCELLED'] as const)('en %s no hay botón de "Pasar a"', (status) => {
    setup(makeJob({ id: 1, status }));

    expect(screen.queryByRole('button', { name: /Pasar a/ })).toBeNull();
  });

  it('elegir un estado posterior (saltea pasos) y "Aplicar" lo aplica sin confirmar', async () => {
    const { user, calls } = setup(makeJob({ id: 1, status: 'QUOTED' }));

    await chooseAndApply(user, 'Terminado');

    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]?.body).toEqual({ status: 'COMPLETED' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('cancelar desde un estado abierto se aplica sin confirmar', async () => {
    const { user, calls } = setup(makeJob({ id: 1, status: 'IN_PROGRESS' }));

    await chooseAndApply(user, 'Cancelado');

    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]?.body).toEqual({ status: 'CANCELLED' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('"Aplicar" sin elegir un estado no hace nada', async () => {
    const { user, calls } = setup(makeJob({ id: 1, status: 'QUOTED' }));

    await user.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(screen.getByRole('button', { name: 'Aplicar' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(patches(calls)).toHaveLength(0);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('JobStatusControl (retroceder y reabrir)', () => {
  it('elegir un estado anterior y "Aplicar" abre la confirmación; el PATCH va recién al confirmar', async () => {
    const { user, calls } = setup(makeJob({ id: 1, status: 'IN_PROGRESS' }));

    await chooseAndApply(user, 'Presupuestado');

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('¿Volver a Presupuestado?')).toBeTruthy();
    expect(patches(calls)).toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: 'Sí, volver' }));

    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]?.body).toEqual({ status: 'QUOTED' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('cancelar la confirmación no cambia nada', async () => {
    const { user, calls } = setup(makeJob({ id: 1, status: 'IN_PROGRESS' }));
    await chooseAndApply(user, 'Presupuestado');

    await user.click(within(await screen.findByRole('alertdialog')).getByText('Cancelar'));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(patches(calls)).toHaveLength(0);
  });

  it('volver desde Terminado avisa que se borra la fecha de terminado', async () => {
    const { user } = setup(makeJob({ id: 1, status: 'COMPLETED' }));

    await chooseAndApply(user, 'En curso');

    expect(await screen.findByText(/Se borra la fecha de terminado/)).toBeTruthy();
  });

  it('retroceder entre estados abiertos aclara que fechas y cobros no cambian', async () => {
    const { user } = setup(makeJob({ id: 1, status: 'IN_PROGRESS' }));

    await chooseAndApply(user, 'Agendado');

    expect(await screen.findByText(/Las fechas y los cobros no cambian/)).toBeTruthy();
  });

  it('reabrir un cancelado pide confirmación ("Reabrir") antes del PATCH', async () => {
    const { user, calls } = setup(makeJob({ id: 1, status: 'CANCELLED' }));

    await chooseAndApply(user, 'Agendado');

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('¿Reabrir el trabajo?')).toBeTruthy();
    expect(patches(calls)).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: 'Reabrir' }));

    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]?.body).toEqual({ status: 'SCHEDULED' });
  });

  it('un trabajo entregado puede volver a un estado anterior (con confirmación)', async () => {
    const { user, calls } = setup(makeJob({ id: 1, status: 'DELIVERED' }));

    await chooseAndApply(user, 'Terminado');

    expect(await screen.findByRole('alertdialog')).toBeTruthy();
    expect(patches(calls)).toHaveLength(0);
  });

  it('si la API rechaza el cambio, cierra la confirmación y avisa el error', async () => {
    const { user } = setup(makeJob({ id: 1, status: 'IN_PROGRESS' }), (call) =>
      call.method === 'PATCH'
        ? errorResponse(409, 'JOB_CHANGED', 'El trabajo cambió mientras tanto')
        : undefined,
    );
    await chooseAndApply(user, 'Presupuestado');

    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Sí, volver' }),
    );

    expect(await screen.findByText('El trabajo cambió mientras tanto')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });
});

describe('JobStatusControl (entregado)', () => {
  it('la opción Cancelado aparece "(no disponible)" y deshabilitada', () => {
    setup(makeJob({ id: 1, status: 'DELIVERED' }));

    const option = screen.getByRole('option', { name: 'Cancelado (no disponible)' });
    expect((option as HTMLOptionElement).disabled).toBe(true);
    expect(screen.getByText('Un trabajo entregado no se puede cancelar.')).toBeTruthy();
  });

  it('en los demás estados Cancelado está disponible', () => {
    setup(makeJob({ id: 1, status: 'COMPLETED' }));

    const option = screen.getByRole('option', { name: 'Cancelado' });
    expect((option as HTMLOptionElement).disabled).toBe(false);
  });

  it('el estado actual no se ofrece en la lista', () => {
    setup(makeJob({ id: 1, status: 'IN_PROGRESS' }));

    const select = screen.getByLabelText('Cambiar a otro estado');
    const names = within(select)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(names).not.toContain('En curso');
    expect(names).toContain('Presupuestado');
  });
});
