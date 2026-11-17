// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue, useDelayedFlag } from './hooks';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useDelayedFlag', () => {
  it('se activa recién después del retraso y se apaga al terminar la carga', () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active, 3000), {
      initialProps: { active: true },
    });

    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(2999));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);

    rerender({ active: false });
    expect(result.current).toBe(false);
  });

  it('una nueva carga vuelve a esperar el retraso completo', () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active, 3000), {
      initialProps: { active: true },
    });
    act(() => vi.advanceTimersByTime(3000));
    rerender({ active: false });
    rerender({ active: true });

    expect(result.current).toBe(false);
  });

  it('una carga rápida nunca muestra el aviso', () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active, 3000), {
      initialProps: { active: true },
    });
    act(() => vi.advanceTimersByTime(500));
    rerender({ active: false });
    act(() => vi.advanceTimersByTime(5000));

    expect(result.current).toBe(false);
  });
});

describe('useDebouncedValue', () => {
  it('devuelve el último valor cuando deja de cambiar', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    });
    rerender({ value: 'ab' });
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: 'abc' });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe('abc');
  });
});
