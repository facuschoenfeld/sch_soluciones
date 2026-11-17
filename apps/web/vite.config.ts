import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defaultClientConditions, defaultServerConditions, defineConfig } from 'vite';

const rootEnvPath = fileURLToPath(new URL('../../.env', import.meta.url));

/**
 * Puerto de la API para el proxy de desarrollo, tomado del `.env` único de la raíz.
 * No se usa `loadEnv` de Vite a propósito: si el archivo trae NODE_ENV=development, Vite lo
 * aplica también a `vite build` y genera un bundle de desarrollo (React sin minificar, etc.).
 */
function readApiPort(): string {
  if (process.env.PORT) return process.env.PORT;
  try {
    return parseEnv(readFileSync(rootEnvPath, 'utf8')).PORT ?? '3000';
  } catch {
    return '3000';
  }
}

export default defineConfig(() => {
  const proxy = { '/api': { target: `http://localhost:${readApiPort()}`, changeOrigin: true } };

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
      // Se compila el código fuente de shared (condición `@sch/source`, igual que tsc y tsx).
      // Resolver por el paquete, y no con un alias, respeta su `sideEffects: false`: así lo que
      // el front no usa (los esquemas Zod) queda fuera del bundle.
      conditions: ['@sch/source', ...defaultClientConditions],
    },
    // Los tests de Vitest en entorno Node resuelven como SSR: misma condición.
    ssr: { resolve: { conditions: ['@sch/source', ...defaultServerConditions] } },
    server: {
      port: 5173,
      strictPort: true,
      proxy,
    },
    // `vite preview` sirve el build con el mismo proxy (útil para probar con Lighthouse).
    preview: { port: 4173, strictPort: true, proxy },
  };
});
