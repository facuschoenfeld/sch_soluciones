# SCH Soluciones

Sitio de servicios (desarrollo web y de escritorio + servicio técnico de PC) con contacto por WhatsApp, y panel de administración privado.

Monorepo con **pnpm workspaces**: `apps/web` (React + Vite), `apps/api` (Express + Prisma) y `packages/shared` (tipos y esquemas Zod).

## Requisitos

- Node.js ≥ 22.12 (recomendado: la última LTS)
- pnpm 12, la versión fijada en `packageManager`. La forma recomendada de instalarlo es `corepack enable`, que usa exactamente esa versión.
- PostgreSQL ≥ 15 instalado localmente y corriendo (sin Docker)

## Arranque

```bash
cp .env.example .env    # completar POSTGRES_ADMIN_URL con la contraseña del usuario postgres
pnpm i
pnpm db:setup           # crea el rol sch_app y las bases services_app_dev y services_app_test
pnpm db:migrate         # aplica las migraciones a la base de desarrollo
pnpm dev                # API en http://localhost:3000 · web en http://localhost:5173
```

En Windows (PowerShell), el primer paso es `Copy-Item .env.example .env`.

Para cargar los datos de ejemplo (configuración, categorías, servicios y el admin), completá `ADMIN_EMAIL` y `ADMIN_PASSWORD` (mínimo 12 caracteres) en el `.env` y corré `pnpm db:seed`. El seed es idempotente: crea solo lo que falta y nunca pisa lo editado desde el panel. El admin se crea una única vez; cambiar `ADMIN_EMAIL` después no crea otro.

## Tests

`pnpm test` necesita Postgres corriendo: los tests de integración de la API usan la base `services_app_test` (`TEST_DATABASE_URL`), que se migra automáticamente y se vacía en cada corrida. Por seguridad, el nombre de esa base debe terminar en `_test`.

## Scripts

| Comando           | Descripción                                                         |
| ----------------- | ------------------------------------------------------------------- |
| `pnpm dev`        | API y web en modo desarrollo (la web hace proxy de `/api` a la API) |
| `pnpm build`      | Compila `shared`, `api` y `web`                                     |
| `pnpm start`      | Levanta la API compilada                                            |
| `pnpm lint`       | ESLint                                                              |
| `pnpm typecheck`  | Chequeo de tipos en todos los paquetes                              |
| `pnpm test`       | Tests (Vitest + Supertest)                                          |
| `pnpm format`     | Prettier                                                            |
| `pnpm db:setup`   | Crea rol y bases locales (idempotente)                              |
| `pnpm db:migrate` | Crea/aplica migraciones en desarrollo                               |
| `pnpm db:seed`    | Carga datos iniciales (idempotente)                                 |

## API

Respuestas en JSON. Las no paginadas vienen como `{ data }`, y los errores como `{ error: { code, message, details? } }`.

| Endpoint                         | Descripción                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `GET /api/health`                | 200 sin consultar la base. Lo usará el monitor externo para evitar el arranque en frío.                |
| `GET /api/health/db`             | Verifica la conexión a PostgreSQL (503 si no está disponible).                                         |
| `GET /api/public/settings`       | Datos públicos del negocio y plantillas de WhatsApp.                                                   |
| `GET /api/public/categories`     | Categorías activas, ordenadas.                                                                         |
| `GET /api/public/services`       | Servicios activos. Filtros opcionales: `?category=<slug>` y `?q=<texto>` (nombre o descripción corta). |
| `GET /api/public/services/:slug` | Detalle de un servicio activo (incluye la descripción en markdown).                                    |

## Variables de entorno

Ver [`.env.example`](.env.example). Hay un único `.env` en la raíz del repo y nunca se commitea.
