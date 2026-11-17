# CLAUDE.md

## Reglas para editar este archivo

- Al escribir o actualizar este CLAUDE.md, **no modificar la sección "Automatización de sub-agentes"**. Solo el usuario puede cambiarla.

## Automatización de sub-agentes

- **code-reviewer**: lanzarlo después de escribir código para revisar esos cambios, y siempre antes de cada commit.
- **test-runner**: lanzarlo después de implementar una nueva funcionalidad.
- **ui-ux-reviewer**: lanzarlo cuando se trabaje en el frontend, para auditar las interfaces.
- **researcher**: lanzarlo únicamente cuando haga falta explorar el código o la web para responder preguntas relacionadas con este proyecto. No usar el modelo principal para estos fines.
- **security-auditor**: no se automatiza. Recomendar su lanzamiento al usuario cuando se considere necesario (por ejemplo, al tocar auth, pagos, uploads o APIs, o antes de un release).

## Proyecto

Sitio público de servicios (desarrollo web/escritorio + servicio técnico de PC) con contacto por WhatsApp, y panel de administración privado (un único admin) con catálogo de servicios y mini CRM de clientes/trabajos. El brief completo y las fases están en `SCHSOLUCIONES_PROMPT_CC.md`.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm i` | Instala dependencias (y corre `prisma generate`) |
| `pnpm db:setup` | Crea rol y bases `services_app_dev` / `services_app_test` en el Postgres local (usa `POSTGRES_ADMIN_URL`) |
| `pnpm db:migrate` | `prisma migrate dev` sobre la base de desarrollo |
| `pnpm db:seed` | Seed idempotente |
| `pnpm dev` | API (`:3000`, tsx watch) + web (`:5173`, Vite con proxy `/api`) |
| `pnpm build` | Compila shared → api → web |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | ESLint, `tsc --noEmit` y Vitest en todos los paquetes |
| `pnpm format` | Prettier |
| `pnpm --filter @sch/api db:studio` | Prisma Studio |

## Estructura

```
apps/web         React + Vite + React Router + TanStack Query + Tailwind v4 + shadcn/ui
  src/components/ui      componentes shadcn (se agregan con `pnpm dlx shadcn@latest add <x>` desde apps/web)
  src/components/layout  header, footer, layouts
  src/pages              una página por archivo
  src/lib                api-client, query-client, utils
apps/api         Express 5 + Prisma 7 (driver adapter pg)
  prisma/                schema.prisma, migrations/, seed.ts
  prisma.config.ts       URLs de conexión (DIRECT_URL para migraciones)
  src/app.ts             arma la app (testeable con Supertest); src/server.ts la levanta
  src/config/env.ts      validación de variables de entorno con Zod
  src/modules/<x>/       <x>.routes.ts · <x>.controller.ts · <x>.service.ts
  src/middlewares/       manejo de errores, auth (Fase 4)
  src/generated/         cliente Prisma generado (no se versiona)
  test/                  tests de la API
packages/shared  esquemas Zod, tipos y utilidades compartidas (@sch/shared)
scripts/         db-setup.ts
```

## Convenciones

- **Idioma:** interfaz y textos visibles en español (es-AR). Código, nombres de archivos, rutas de la API, tablas, columnas, enums y migraciones en **inglés**. Commits y comentarios técnicos en **español**.
- **Commits:** Conventional Commits con tipo en inglés y descripción en español (ej.: `feat(services): agrega actualización masiva de precios`).
- **TypeScript** `strict` en todo el repo, sin `any` (ESLint lo marca como error). Imports de tipos con `import type`.
- **API:** imports relativos con extensión `.js` (ESM NodeNext). Errores con `AppError(status, code, message)`; formato uniforme `{ error: { code, message, details? } }`. Paginación `?page=&pageSize=` → `{ data, meta: { page, pageSize, total } }`.
- **Base de datos:** modelos en PascalCase; tablas y columnas en snake_case vía `@map`/`@@map`. Los enums de Prisma se replican en `packages/shared/src/enums.ts` (hay un test que fija sus valores).
- **`@sch/shared`:** en desarrollo se consume desde el código fuente (condición `@sch/source` en tsc/tsx, alias en Vite/Vitest); en el build de la API, desde su `dist`.
- **Env:** un único `.env` en la raíz (ver `.env.example`). Toda variable nueva se agrega a `.env.example` y a `src/config/env.ts`.
- **Front:** alias `@/` → `apps/web/src`. Archivos de componentes en kebab-case.
- **Precios:** ARS por defecto, USD opcional por servicio; formato `es-AR` (`$ 25.000`).
- **Datos personales** (Ley 25.326): nunca exponer datos de clientes en endpoints públicos ni en logs. El logger HTTP solo registra método, ruta y status.

## Reglas de trabajo

1. Una fase a la vez; no adelantar funcionalidades de fases futuras. Al terminar cada fase: resumen, archivos, pasos para probar, tests en verde, pendientes; y esperar confirmación.
2. Código pequeño, tipado y legible. Sin dependencias innecesarias; si se agrega una, justificarla en una línea.
3. Nunca commitear secretos. Todo por variables de entorno, con `.env.example` actualizado.
4. Toda entrada se valida con Zod en el servidor (el front valida por UX, el back por seguridad).
5. Consultas con Prisma (parametrizadas); nada de SQL concatenado.
6. UI mobile-first y accesible (labels, foco visible, contraste), con estados de carga/vacío/error en todas las pantallas.
7. Sin Docker en ningún entorno. Producción: un único Web Service de Render (Express sirve `/api` y `apps/web/dist`) + Neon.
8. Ante una decisión de diseño ambigua que cambie el alcance, preguntar en vez de asumir. No cambiar el stack sin proponerlo antes.

## Decisiones tomadas (desvíos del brief)

- Hash de contraseñas: `@node-rs/argon2` (argon2id con binarios precompilados), sin fallback a bcrypt.
- Prisma 7: la URL directa de migraciones va en `prisma.config.ts` (no en `schema.prisma`).
- `Job` guarda además `servicePriceSnapshot` y `servicePriceTypeSnapshot`; `serviceNameSnapshot` es nullable (trabajos sin servicio del catálogo).
- Exportación de clientes/trabajos: PDF + CSV.
- TypeScript 6.0 (typescript-eslint aún no soporta TS 7) y React Router 7 (React Router 8 exige Node ≥ 22.22).
- Restricciones CHECK escritas a mano en la migración `init` (Prisma no las modela): Settings fila única, `priceAmount` null ⇔ `QUOTE`, montos ≥ 0. Si una migración futura recrea esas tablas, hay que conservarlas.
- `NODE_ENV` es obligatoria (sin valor por defecto) para que producción nunca arranque en modo desarrollo.
- `/api/health/db` cachea el último ping exitoso durante 15 s (limita pings, pero no evita que alguien mantenga Neon despierto). **Pendiente Fase 7:** protegerlo o limitarlo antes de producción.
- Logs: los errores de Prisma se registran sin `message` (solo name/code/modelName), porque el mensaje puede incluir datos de clientes. `CLAUDE.md` está excluido de Prettier.
