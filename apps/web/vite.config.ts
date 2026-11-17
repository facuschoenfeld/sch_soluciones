import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig(({ mode }) => {
  // El `.env` es único y vive en la raíz del monorepo; de ahí se toma el puerto de la API.
  const env = loadEnv(mode, rootDir, '');
  const apiPort = env.PORT ?? '3000';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        // Se compila el código fuente de shared junto con la app.
        '@sch/shared': fileURLToPath(
          new URL('../../packages/shared/src/index.ts', import.meta.url),
        ),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target: `http://localhost:${apiPort}`, changeOrigin: true },
      },
    },
  };
});
