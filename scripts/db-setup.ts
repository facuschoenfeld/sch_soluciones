// Crea (o actualiza) el rol de la app y las bases de desarrollo y de tests en el Postgres local.
// Idempotente: se puede correr varias veces. Uso: `pnpm db:setup`.
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import pg from 'pg';

loadDotenv({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

const DEFAULT_TEST_DB = 'services_app_test';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable ${name} en el .env (ver .env.example).`);
  }
  return value;
}

function databaseName(url: URL): string {
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!name) throw new Error(`La URL ${url.host} no indica el nombre de la base.`);
  return name;
}

/**
 * Crea la base en UTF-8. En Windows el locale por defecto del servidor suele ser de tipo
 * "Spanish_Argentina.1252", incompatible con UTF-8; en ese caso se usa ICU (es-AR) para el
 * ordenamiento y el locale "C" (compatible con cualquier encoding) para lo demás.
 */
async function createUtf8Database(
  client: pg.Client,
  db: string,
  ownerIdent: string,
): Promise<void> {
  const base = `CREATE DATABASE ${client.escapeIdentifier(db)} OWNER ${ownerIdent} ENCODING 'UTF8' TEMPLATE template0`;
  try {
    await client.query(base);
  } catch (error) {
    const isLocaleMismatch = error instanceof Error && 'code' in error && error.code === '22023';
    if (!isLocaleMismatch) throw error;
    await client.query(`${base} LOCALE 'C' LOCALE_PROVIDER icu ICU_LOCALE 'es-AR'`);
  }
}

async function main(): Promise<void> {
  const adminUrl = requireEnv('POSTGRES_ADMIN_URL');
  const appUrl = new URL(requireEnv('DATABASE_URL'));
  const role = decodeURIComponent(appUrl.username);
  const password = decodeURIComponent(appUrl.password);
  if (!role || !password) {
    throw new Error('DATABASE_URL debe incluir usuario y contraseña del rol de la app.');
  }

  const devDb = databaseName(appUrl);
  const testDb = process.env.TEST_DATABASE_URL
    ? databaseName(new URL(process.env.TEST_DATABASE_URL))
    : DEFAULT_TEST_DB;
  if (devDb === testDb) {
    throw new Error(
      `La base de tests no puede ser la misma que la de desarrollo ("${devDb}"): los tests la vaciarían.`,
    );
  }

  const adminUrlParsed = new URL(adminUrl);
  const protectedDbs = new Set([
    'postgres',
    'template0',
    'template1',
    databaseName(adminUrlParsed),
  ]);
  for (const db of [devDb, testDb]) {
    if (protectedDbs.has(db)) {
      throw new Error(`"${db}" es una base del sistema o de administración; usá otro nombre.`);
    }
  }

  const adminRole = decodeURIComponent(adminUrlParsed.username);
  if (role === adminRole) {
    throw new Error(
      `DATABASE_URL usa el mismo usuario que POSTGRES_ADMIN_URL ("${role}"). La app necesita un rol propio.`,
    );
  }

  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();

  try {
    const roleIdent = client.escapeIdentifier(role);
    const passwordLiteral = client.escapeLiteral(password);
    const existing = await client.query<{ rolsuper: boolean }>(
      'SELECT rolsuper FROM pg_roles WHERE rolname = $1',
      [role],
    );

    // Nunca modificar un superusuario (le cambiaría la contraseña a un rol administrativo).
    if (existing.rows[0]?.rolsuper) {
      throw new Error(`El rol "${role}" es superusuario. Usá otro nombre de rol en DATABASE_URL.`);
    }

    // CREATEDB es necesario para la "shadow database" que usa `prisma migrate dev`.
    if (existing.rowCount === 0) {
      await client.query(
        `CREATE ROLE ${roleIdent} WITH LOGIN CREATEDB PASSWORD ${passwordLiteral}`,
      );
      console.log(`✔ Rol "${role}" creado`);
    } else {
      await client.query(`ALTER ROLE ${roleIdent} WITH LOGIN CREATEDB PASSWORD ${passwordLiteral}`);
      console.log(`✔ Rol "${role}" ya existía (contraseña sincronizada con el .env)`);
    }

    for (const db of [devDb, testDb]) {
      const exists = await client.query<{ owner: string }>(
        'SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = $1',
        [db],
      );
      const currentOwner = exists.rows[0]?.owner;
      if (currentOwner === undefined) {
        await createUtf8Database(client, db, roleIdent);
        console.log(`✔ Base "${db}" creada`);
      } else if (currentOwner !== role) {
        // Sin ser dueño, `prisma migrate` fallaría por permisos.
        await client.query(`ALTER DATABASE ${client.escapeIdentifier(db)} OWNER TO ${roleIdent}`);
        console.log(`✔ Base "${db}" ya existía (dueño cambiado de "${currentOwner}" a "${role}")`);
        console.warn(
          `  ⚠ Los objetos ya creados por "${currentOwner}" siguen siendo suyos. Si "${db}" tenía tablas,\n` +
            `    ejecutá conectado a esa base: REASSIGN OWNED BY "${currentOwner}" TO "${role}";`,
        );
      } else {
        console.log(`✔ Base "${db}" ya existía`);
      }
    }
  } finally {
    await client.end();
  }

  console.log('\nListo. Siguiente paso: pnpm db:migrate');
}

main().catch((error: unknown) => {
  console.error('✖ db:setup falló:', error instanceof Error ? error.message : error);
  process.exit(1);
});
