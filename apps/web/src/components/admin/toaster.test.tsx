// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from './toaster';

afterEach(() => {
  vi.restoreAllMocks();
  act(() => toast.dismiss());
  cleanup();
});

function renderWithToast() {
  const user = userEvent.setup();
  render(
    <>
      <input aria-label="Campo" />
      <Toaster />
    </>,
  );
  act(() => {
    toast('Servicio archivado', { action: { label: 'Deshacer', onClick: () => {} } });
  });
  return user;
}

describe('Toaster', () => {
  it('Escape con el foco en los toasts (Alt+T) los cierra y devuelve el foco', async () => {
    const user = renderWithToast();
    await screen.findByText('Servicio archivado');
    const input = screen.getByLabelText('Campo');
    await user.click(input);
    await user.keyboard('{Alt>}t{/Alt}');
    expect(input).not.toBe(document.activeElement);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText('Servicio archivado')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(input));
  });

  it('Escape con el foco en un botón del toast también los cierra', async () => {
    const user = renderWithToast();
    const undo = await screen.findByRole('button', { name: 'Deshacer' });
    act(() => undo.focus());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText('Servicio archivado')).toBeNull());
  });

  it('Escape con el foco fuera de los toasts no los toca', async () => {
    const user = renderWithToast();
    await screen.findByText('Servicio archivado');
    const dismiss = vi.spyOn(toast, 'dismiss');
    await user.click(screen.getByLabelText('Campo'));
    await user.keyboard('{Escape}');
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('ignora un Escape que ya consumió otra capa (ej. un diálogo de Radix)', async () => {
    const user = renderWithToast();
    const undo = await screen.findByRole('button', { name: 'Deshacer' });
    const consume = (event: KeyboardEvent) => {
      if (event.key === 'Escape') event.preventDefault();
    };
    document.addEventListener('keydown', consume, { capture: true });
    try {
      const dismiss = vi.spyOn(toast, 'dismiss');
      act(() => undo.focus());
      await user.keyboard('{Escape}');
      expect(dismiss).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', consume, { capture: true });
    }
  });
});
