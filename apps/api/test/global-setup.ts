import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getTestDatabaseUrl } from './helpers/test-db.js';

/** Antes de correr los tests: aplica las migraciones pendientes en la base de tests. */
export default function setup(): void {
  const url = getTestDatabaseUrl();
  execSync('pnpm exec prisma migrate deploy', {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    stdio: 'pipe',
  });
}
