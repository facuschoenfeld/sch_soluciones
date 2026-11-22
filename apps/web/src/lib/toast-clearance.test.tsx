// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { avoidToasts } from './toast-clearance';

const clearance = () => document.documentElement.style.getPropertyValue('--toast-clearance');

/** ResizeObserver de mentira: guarda los callbacks para dispararlos a mano. */
const resizeCallbacks = new Map<Element, () => void>();

class FakeResizeObserver {
  private readonly callback: () => void;
  private readonly targets: Element[] = [];
  constructor(callback: () => void) {
    this.callback = callback;
  }
  observe(target: Element) {
    this.targets.push(target);
    resizeCallbacks.set(target, this.callback);
  }
  disconnect() {
    for (const target of this.targets) resizeCallbacks.delete(target);
  }
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resizeCallbacks.clear();
});

/** jsdom no maqueta: el alto se fija a mano antes de que React llame al ref. */
function setHeight(element: HTMLElement, height: number) {
  Object.defineProperty(element, 'offsetHeight', { configurable: true, value: height });
}

function Bar({ id, height, bottom }: { id: string; height: number; bottom?: string }) {
  return (
    <div
      data-testid={id}
      style={bottom ? { bottom } : undefined}
      ref={(element) => {
        if (element) setHeight(element, height);
        return avoidToasts(element);
      }}
    />
  );
}

describe('avoidToasts', () => {
  it('publica alto + separación del borde y lo quita al desmontar la barra', () => {
    const { unmount } = render(<Bar id="a" height={40} bottom="16px" />);
    expect(clearance()).toBe('56px');
    unmount();
    expect(clearance()).toBe('');
  });

  it('se actualiza cuando la barra cambia de alto', () => {
    const { getByTestId } = render(<Bar id="a" height={40} />);
    const bar = getByTestId('a');
    setHeight(bar, 72);
    act(() => resizeCallbacks.get(bar)?.());
    expect(clearance()).toBe('72px');
  });

  it('con dos barras publica la mayor y, al irse una, conserva la de la otra', () => {
    const Bars = ({ showA, showB }: { showA: boolean; showB: boolean }) => (
      <div>
        {showA && <Bar id="a" height={40} />}
        {showB && <Bar id="b" height={60} />}
      </div>
    );
    const { rerender } = render(<Bars showA showB />);
    expect(clearance()).toBe('60px');
    // Se va la que se montó última (la más alta): la otra sigue protegida.
    rerender(<Bars showA showB={false} />);
    expect(clearance()).toBe('40px');
    rerender(<Bars showA={false} showB={false} />);
    expect(clearance()).toBe('');
  });
});
