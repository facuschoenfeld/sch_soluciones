import { vi } from 'vitest';
import { settingsFixture } from '@/test/fixtures';

export interface ApiCall {
  method: string;
  path: string;
  /** Query string con el "?" (vacío si no hay). */
  search: string;
  body: unknown;
}

export interface AdminApiOptions {
  /** Sesión inicial: `{ email }` (con sesión) o `null` (sin sesión). */
  session?: { email: string } | null;
  /** Si se indica, `GET /api/auth/me` responde ese status de error en lugar de la sesión. */
  meStatus?: number;
  /** Respuestas propias por ruta; si devuelve `undefined`, se usa la respuesta por defecto. */
  handler?: (call: ApiCall) => Response | undefined;
}

export const ADMIN_EMAIL = 'admin@example.com';

export function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return Response.json({ error: { code, message, details } }, { status });
}

/** jsdom no trae window.matchMedia (lo usa ThemeToggle). */
export function stubMatchMedia() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

/** Simula la API: sesión, logout, ajustes (públicos y del panel) y las rutas de `handler`. */
export function stubAdminApi({ session = null, meStatus, handler }: AdminApiOptions = {}) {
  const state = { session };
  const calls: ApiCall[] = [];

  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input, 'http://localhost');
    const method = init?.method ?? 'GET';
    const raw = typeof init?.body === 'string' ? init.body : undefined;
    const call: ApiCall = {
      method,
      path: url.pathname,
      search: url.search,
      body: raw === undefined ? undefined : (JSON.parse(raw) as unknown),
    };
    calls.push(call);

    const custom = handler?.(call);
    if (custom) return custom;

    if (method === 'GET' && url.pathname === '/api/auth/me') {
      if (meStatus) return errorResponse(meStatus, 'INTERNAL_ERROR', 'Error');
      return Response.json({ data: state.session });
    }
    if (method === 'POST' && url.pathname === '/api/auth/logout') {
      state.session = null;
      return new Response(null, { status: 204 });
    }
    if (
      method === 'GET' &&
      (url.pathname === '/api/public/settings' || url.pathname === '/api/admin/settings')
    ) {
      return Response.json({ data: settingsFixture });
    }
    return errorResponse(404, 'NOT_FOUND', 'No');
  });

  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, calls, state };
}
