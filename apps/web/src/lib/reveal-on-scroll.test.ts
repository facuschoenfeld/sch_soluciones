// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableRevealOnScroll, REVEAL_READY_CLASS, useRevealOnScroll } from './reveal-on-scroll';

type Callback = (entries: IntersectionObserverEntry[]) => void;

/** IntersectionObserver de mentira: registra qué observa y permite disparar intersecciones a mano. */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly observed = new Set<Element>();
  disconnected = false;
  readonly callback: Callback;
  readonly options: IntersectionObserverInit | undefined;

  constructor(callback: Callback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    FakeIntersectionObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.add(el);
  }
  unobserve(el: Element) {
    this.observed.delete(el);
  }
  disconnect() {
    this.disconnected = true;
    this.observed.clear();
  }
  trigger(targets: Element[], isIntersecting = true) {
    this.callback(
      targets.map((target) => ({ target, isIntersecting }) as unknown as IntersectionObserverEntry),
    );
  }
}

const html = document.documentElement;

function addReveal(parent: HTMLElement = document.body): HTMLElement {
  const el = document.createElement('div');
  el.className = 'reveal';
  parent.appendChild(el);
  return el;
}

const lastObserver = () => FakeIntersectionObserver.instances.at(-1)!;

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  html.classList.remove(REVEAL_READY_CLASS);
  document.body.innerHTML = '';
});

describe('enableRevealOnScroll', () => {
  it('agrega reveal-ready a <html> si existe IntersectionObserver', () => {
    enableRevealOnScroll();
    expect(html.classList.contains('reveal-ready')).toBe(true);
  });

  it('no agrega la clase si no existe IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    enableRevealOnScroll();
    expect(html.classList.contains('reveal-ready')).toBe(false);
  });

  it('es idempotente al llamarse dos veces', () => {
    enableRevealOnScroll();
    enableRevealOnScroll();
    expect(html.className.split(' ').filter((c) => c === 'reveal-ready')).toHaveLength(1);
  });
});

describe('useRevealOnScroll', () => {
  it('sin reveal-ready no crea observers ni observa nada', () => {
    const el = addReveal();
    renderHook(() => useRevealOnScroll());
    expect(FakeIntersectionObserver.instances).toHaveLength(0);
    expect(el.classList.contains('is-revealed')).toBe(false);
  });

  it('observa los .reveal existentes y no otros elementos', () => {
    enableRevealOnScroll();
    const a = addReveal();
    const b = addReveal();
    const other = document.createElement('div');
    document.body.appendChild(other);

    renderHook(() => useRevealOnScroll());

    const io = lastObserver();
    expect(io.observed.has(a)).toBe(true);
    expect(io.observed.has(b)).toBe(true);
    expect(io.observed.has(other)).toBe(false);
  });

  it('no observa elementos que ya tienen is-revealed', () => {
    enableRevealOnScroll();
    const done = addReveal();
    done.classList.add('is-revealed');

    renderHook(() => useRevealOnScroll());

    expect(lastObserver().observed.has(done)).toBe(false);
  });

  it('observa los .reveal agregados después (directos y anidados)', async () => {
    enableRevealOnScroll();
    renderHook(() => useRevealOnScroll());
    const io = lastObserver();

    const late = addReveal();
    const wrapper = document.createElement('section');
    const nested = addReveal(wrapper);
    document.body.appendChild(wrapper);

    await waitFor(() => {
      expect(io.observed.has(late)).toBe(true);
      expect(io.observed.has(nested)).toBe(true);
    });
  });

  it('deja de observar los .reveal que se desmontan sin revelarse (directos y anidados)', async () => {
    const direct = addReveal();
    const wrapper = document.createElement('section');
    const nested = addReveal(wrapper);
    document.body.appendChild(wrapper);
    enableRevealOnScroll();
    renderHook(() => useRevealOnScroll());
    const io = lastObserver();
    expect(io.observed.has(direct)).toBe(true);
    expect(io.observed.has(nested)).toBe(true);

    direct.remove();
    wrapper.remove();

    await waitFor(() => {
      expect(io.observed.has(direct)).toBe(false);
      expect(io.observed.has(nested)).toBe(false);
    });
  });

  it('al intersectar agrega is-revealed y deja de observar el elemento', () => {
    enableRevealOnScroll();
    const el = addReveal();
    renderHook(() => useRevealOnScroll());
    const io = lastObserver();

    io.trigger([el]);

    expect(el.classList.contains('is-revealed')).toBe(true);
    expect(el.style.getPropertyValue('--reveal-delay')).toBe('0ms');
    expect(io.observed.has(el)).toBe(false);
  });

  it('ignora las entradas que no intersectan', () => {
    enableRevealOnScroll();
    const el = addReveal();
    renderHook(() => useRevealOnScroll());
    const io = lastObserver();

    io.trigger([el], false);

    expect(el.classList.contains('is-revealed')).toBe(false);
    expect(el.style.getPropertyValue('--reveal-delay')).toBe('');
    expect(io.observed.has(el)).toBe(true);
  });

  it('escalona --reveal-delay de a 80 ms con tope de 320 ms', () => {
    enableRevealOnScroll();
    const els = Array.from({ length: 7 }, () => addReveal());
    renderHook(() => useRevealOnScroll());

    lastObserver().trigger(els);

    expect(els.map((el) => el.style.getPropertyValue('--reveal-delay'))).toEqual([
      '0ms',
      '80ms',
      '160ms',
      '240ms',
      '320ms',
      '320ms',
      '320ms',
    ]);
  });

  it('el escalonado no cuenta las entradas que no intersectan', () => {
    enableRevealOnScroll();
    const [a, b, c] = [addReveal(), addReveal(), addReveal()];
    renderHook(() => useRevealOnScroll());
    const io = lastObserver();

    io.callback([
      { target: a, isIntersecting: false },
      { target: b, isIntersecting: true },
      { target: c, isIntersecting: true },
    ] as unknown as IntersectionObserverEntry[]);

    expect(a.style.getPropertyValue('--reveal-delay')).toBe('');
    expect(b.style.getPropertyValue('--reveal-delay')).toBe('0ms');
    expect(c.style.getPropertyValue('--reveal-delay')).toBe('80ms');
  });

  it('al desmontar desconecta el IntersectionObserver y el MutationObserver', async () => {
    enableRevealOnScroll();
    const disconnectSpy = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const { unmount } = renderHook(() => useRevealOnScroll());
    const io = lastObserver();

    unmount();

    expect(io.disconnected).toBe(true);
    expect(disconnectSpy).toHaveBeenCalledTimes(1);

    // Tras desmontar, los nodos nuevos ya no se observan.
    addReveal();
    await Promise.resolve();
    expect(io.observed.size).toBe(0);
    disconnectSpy.mockRestore();
  });
});
