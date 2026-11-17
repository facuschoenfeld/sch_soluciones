import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // En tests se usa el código fuente de shared, sin necesidad de compilarlo.
      '@sch/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // Migra la base de tests (services_app_test) antes de empezar.
    globalSetup: ['./test/global-setup.ts'],
    // Los tests de integración comparten la base de tests: se corren de a un archivo.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
    },
  },
});
