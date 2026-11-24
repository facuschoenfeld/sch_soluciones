// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { forwardRef, useImperativeHandle, type HTMLAttributes } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimatedIcon, type AnimateIcon } from './animated-icon';
import { IconAnimationContext } from './icon-animation-context';

const startAnimation = vi.fn();
const stopAnimation = vi.fn();

const FakeIcon = forwardRef<unknown, HTMLAttributes<HTMLDivElement> & { size?: number }>(
  function FakeIcon({ size: _size, ...props }, ref) {
    useImperativeHandle(ref, () => ({ startAnimation, stopAnimation }));
    return <div data-testid="icon" {...props} />;
  },
) as unknown as AnimateIcon;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AnimatedIcon', () => {
  it('es decorativo (aria-hidden) y refleja el size en --icon-size', () => {
    render(
      <button type="button">
        <AnimatedIcon icon={FakeIcon} size={24} />
      </button>,
    );
    const icon = screen.getByTestId('icon');
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.style.getPropertyValue('--icon-size')).toBe('24px');
    // Marca para que `Button` ajuste el relleno (`has-[>svg,>[data-animated-icon]]`).
    expect(icon.hasAttribute('data-animated-icon')).toBe(true);
  });

  it('no anima con un toque (táctil)', () => {
    render(
      <button type="button">
        <AnimatedIcon icon={FakeIcon} />
      </button>,
    );
    fireEvent.pointerEnter(screen.getByRole('button'), { pointerType: 'touch' });
    expect(startAnimation).not.toHaveBeenCalled();
  });

  it('queda estático con IconAnimationContext en false (panel)', () => {
    render(
      <IconAnimationContext value={false}>
        <button type="button">
          <AnimatedIcon icon={FakeIcon} />
        </button>
      </IconAnimationContext>,
    );
    fireEvent.pointerEnter(screen.getByRole('button'));
    expect(startAnimation).not.toHaveBeenCalled();
  });

  it('usa 16px por defecto', () => {
    render(
      <button type="button">
        <AnimatedIcon icon={FakeIcon} />
      </button>,
    );
    expect(screen.getByTestId('icon').style.getPropertyValue('--icon-size')).toBe('16px');
  });

  it('anima al entrar el puntero al botón contenedor y frena al salir', () => {
    render(
      <button type="button">
        Enviar
        <AnimatedIcon icon={FakeIcon} />
      </button>,
    );
    const button = screen.getByRole('button');
    fireEvent.pointerEnter(button);
    expect(startAnimation).toHaveBeenCalledTimes(1);
    fireEvent.pointerLeave(button);
    expect(stopAnimation).toHaveBeenCalledTimes(1);
  });

  it('usa un [data-icon-trigger] como disparador', () => {
    render(
      <article data-testid="card" data-icon-trigger>
        <AnimatedIcon icon={FakeIcon} />
      </article>,
    );
    const card = screen.getByTestId('card');
    fireEvent.pointerEnter(card);
    expect(startAnimation).toHaveBeenCalledTimes(1);
    fireEvent.pointerLeave(card);
    expect(stopAnimation).toHaveBeenCalledTimes(1);
  });

  it('no anima al apuntar a un elemento ajeno al disparador', () => {
    render(
      <div>
        <button type="button">
          <AnimatedIcon icon={FakeIcon} />
        </button>
        <button type="button">Otro</button>
      </div>,
    );
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Otro' }));
    expect(startAnimation).not.toHaveBeenCalled();
  });

  it('deja de escuchar al desmontarse', () => {
    const { unmount } = render(
      <button type="button">
        <AnimatedIcon icon={FakeIcon} />
      </button>,
    );
    const button = screen.getByRole('button');
    unmount();
    fireEvent.pointerEnter(button);
    expect(startAnimation).not.toHaveBeenCalled();
  });
});
