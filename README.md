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

## Endpoints de salud

- `GET /api/health`: responde 200 sin consultar la base. Lo usará el monitor externo para evitar el arranque en frío.
- `GET /api/health/db`: verifica la conexión a PostgreSQL (503 si no está disponible).

## Variables de entorno

Ver [`.env.example`](.env.example). Hay un único `.env` en la raíz del repo y nunca se commitea.
