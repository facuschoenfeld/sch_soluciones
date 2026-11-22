// @vitest-environment jsdom
import { BULK_MAX_ITEMS } from '@sch/shared';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorResponse, stubAdminApi } from '@/test/admin-api';
import { makeService } from '@/test/admin-fixtures';
import { renderWithProviders } from '@/test/render';
import { BulkPriceDialog } from './bulk-price-dialog';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderDialog(services = [makeService({ id: 1, name: 'Limpieza', priceAmount: 10000 })]) {
  renderWithProviders(
    <BulkPriceDialog
      open
      onOpenChange={() => undefined}
      services={services}
      onDone={() => undefined}
    />,
  );
  return userEvent.setup();
}

const applyButton = () => screen.getByRole('button', { name: /^Aplicar/ }) as HTMLButtonElement;

describe('BulkPriceDialog', () => {
  it(`con más de ${BULK_MAX_ITEMS} servicios explica el límite y no deja aplicar`, async () => {
    stubAdminApi({ session: { email: 'admin@example.com' } });
    const services = Array.from({ length: BULK_MAX_ITEMS + 1 }, (_, index) =>
      makeService({ id: index + 1, name: `Servicio ${index + 1}`, priceAmount: 1000 }),
    );
    const user = renderDialog(services);

    await user.type(screen.getByLabelText('Porcentaje'), '10');

    expect(
      screen.getByText(new RegExp(`se pueden actualizar hasta ${BULK_MAX_ITEMS} por vez`)),
    ).toBeTruthy();
    // aria-disabled, asociado al aviso que explica el motivo.
    expect(applyButton().getAttribute('aria-disabled')).toBe('true');
    expect(applyButton().getAttribute('aria-describedby')).toBe(screen.getByRole('status').id);
    // Vista previa resumida.
    expect(screen.getByText(`Y ${BULK_MAX_ITEMS + 1 - 20} más con el mismo ajuste.`)).toBeTruthy();
  });

  it('ante un 409 (un precio cambió) avisa que la vista previa ya se actualizó', async () => {
    stubAdminApi({
      session: { email: 'admin@example.com' },
      handler: (call) =>
        call.path === '/api/admin/services/bulk-price'
          ? errorResponse(409, 'PRICE_CHANGED', 'Algún precio cambió mientras tanto.')
          : undefined,
    });
    const user = renderDialog();

    await user.type(screen.getByLabelText('Porcentaje'), '10');
    await user.click(applyButton());

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(
        /Actualizamos la vista previa con los datos actuales/,
      ),
    );
  });
});
