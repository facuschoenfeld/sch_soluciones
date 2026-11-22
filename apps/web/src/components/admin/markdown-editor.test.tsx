// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownEditor } from './markdown-editor';

afterEach(cleanup);

const selectedTab = () => screen.getByRole('tab', { selected: true }).textContent;

describe('MarkdownEditor', () => {
  it('al aparecer un error vuelve a "Escribir", y después deja volver a la vista previa', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <MarkdownEditor value="**Hola**" textareaProps={{ 'aria-label': 'Descripción' }} />,
    );

    await user.click(screen.getByRole('tab', { name: 'Vista previa' }));
    expect(selectedTab()).toBe('Vista previa');

    rerender(
      <MarkdownEditor
        value="**Hola**"
        hasError
        textareaProps={{ id: 'descripcion', 'aria-label': 'Descripción' }}
      />,
    );
    expect(selectedTab()).toBe('Escribir');
    // El foco estaba en la pestaña "Vista previa": pasa al campo con error.
    expect(document.activeElement).toBe(screen.getByLabelText('Descripción'));

    // Con el error todavía presente, la vista previa se puede volver a abrir.
    await user.click(screen.getByRole('tab', { name: 'Vista previa' }));
    expect(selectedTab()).toBe('Vista previa');
  });
});
