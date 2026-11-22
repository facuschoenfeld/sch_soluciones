# CLAUDE.md

## Reglas para editar este archivo

- Al escribir o actualizar este CLAUDE.md, **no modificar la sección "Automatización de sub-agentes"**. Solo el usuario puede cambiarla.

## Automatización de sub-agentes

- **code-reviewer**: lanzarlo después de escribir código para revisar esos cambios, y siempre antes de cada commit.
- **test-runner**: lanzarlo después de implementar una nueva funcionalidad.
- **ui-ux-reviewer**: lanzarlo cuando se trabaje en el frontend, para auditar las interfaces.
- **researcher**: lanzarlo únicamente cuando haga falta explorar el código o la web para responder preguntas relacionadas con este proyecto. No usar el modelo principal para estos fines.
- **security-auditor**: no se automatiza. Recomendar su lanzamiento al usuario cuando se considere necesario (por ejemplo, al tocar auth, pagos, uploads o APIs, o antes de un release).
- **git-committer**: lanzarlo cuando se pida commitear y pushear los cambios realizados. Usar siempre este sub-agente para ese fin.

## Proyecto

Sitio público de servicios (desarrollo web/escritorio + servicio técnico de PC) con contacto por WhatsApp, y panel de administración privado (un único admin) con catálogo de servicios y mini CRM de clientes/trabajos. El brief completo y las fases están en `SCHSOLUCIONES_PROMPT_CC.md`.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm i` | Instala dependencias (y corre `prisma generate`) |
| `pnpm db:setup` | Crea rol y bases `services_app_dev` / `services_app_test` en el Postgres local (usa `POSTGRES_ADMIN_URL`) |
| `pnpm db:migrate` | `prisma migrate dev` sobre la base de desarrollo |
| `pnpm db:seed` | Seed idempotente (requiere `ADMIN_EMAIL` / `ADMIN_PASSWORD`) |
| `pnpm dev` | API (`:3000`, tsx watch) + web (`:5173`, Vite con proxy `/api`) |
| `pnpm build` | Compila shared → api → web |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | ESLint, `tsc --noEmit` y Vitest en todos los paquetes |
| `pnpm format` | Prettier |
| `pnpm --filter @sch/api db:studio` | Prisma Studio |

## Estructura

```
apps/web         React + Vite + React Router + TanStack Query + Tailwind v4 + shadcn/ui
  src/components/ui      componentes shadcn (se agregan con `pnpm dlx shadcn@latest add <x>` desde apps/web)
  src/components/layout  header, footer, layouts, toggle de tema
  src/components/whatsapp  botón + diálogo de WhatsApp (mensaje pre-cargado y editable)
  src/components/services · feedback  tarjetas de servicio · estados de error/vacío/carga lenta
  src/pages              una página por archivo
  src/lib                api-client, query-client, public-api y admin-api (hooks de TanStack Query), utils
  src/test               fixtures y helper de render para tests de componentes (jsdom)
  src/admin-app.tsx      panel /admin/* (se carga con lazy); src/components/admin, src/pages/admin
apps/api         Express 5 + Prisma 7 (driver adapter pg)
  prisma/                schema.prisma, migrations/, seed.ts
  prisma.config.ts       URLs de conexión (DIRECT_URL para migraciones)
  src/app.ts             arma la app (testeable con Supertest); src/server.ts la levanta
  src/config/env.ts      validación de variables de entorno con Zod
  src/modules/<x>/       <x>.routes.ts · <x>.controller.ts · <x>.service.ts
  src/middlewares/       errores, sesión/requireAuth, seguridad (CSRF, no-store, rate limits)
  src/modules/auth/      login/logout/me, cambio de contraseña, JWT + cookie (session.ts)
  src/modules/admin/     compone /api/admin (cuenta, categories, services, settings)
  src/generated/         cliente Prisma generado (no se versiona)
  test/                  tests de la API
packages/shared  esquemas Zod, tipos y utilidades compartidas (@sch/shared)
scripts/         db-setup.ts
```

## Convenciones

- **Idioma:** interfaz y textos visibles en español (es-AR). Código, nombres de archivos, rutas de la API, tablas, columnas, enums y migraciones en **inglés**. Commits y comentarios técnicos en **español**.
- **Commits:** Conventional Commits con tipo en inglés y descripción en español (ej.: `feat(services): agrega actualización masiva de precios`).
- **Trailer de atribución:** cada commit termina con exactamente `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Es la atribución de la sesión principal, que escribe el código. Se usa esta línea aunque el commit lo haga un sub-agente (ej. `git-committer`) que corra con otro modelo o reciba otra sugerencia de atribución.
- **TypeScript** `strict` en todo el repo, sin `any` (ESLint lo marca como error). Imports de tipos con `import type`.
- **API:** imports relativos con extensión `.js` (ESM NodeNext). Errores con `AppError(status, code, message)`; formato uniforme `{ error: { code, message, details? } }`. Paginación `?page=&pageSize=` → `{ data, meta: { page, pageSize, total } }`.
- **Base de datos:** modelos en PascalCase; tablas y columnas en snake_case vía `@map`/`@@map`. Los enums de Prisma se replican en `packages/shared/src/enums.ts` (hay un test que fija sus valores).
- **`@sch/shared`:** en desarrollo se consume desde el código fuente (condición `@sch/source` en tsc, tsx y Vite; alias en el Vitest de la API); en el build de la API, desde su `dist`.
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
- WhatsApp: `Settings` tiene tres plantillas globales en lugar de `defaultWhatsappTemplate`: `bookingWhatsappTemplate` ("Reservar turno"), `inquiryWhatsappTemplate` ("Hacer una consulta") y `generalWhatsappTemplate` (botón flotante y CTA sin servicio puntual). `Service.whatsappTemplate` reemplaza solo a la de reserva. Una plantilla vacía cae a la de fábrica (`DEFAULT_*_WHATSAPP_TEMPLATE`). Variables: `{{servicio}}`, `{{precio}}`, `{{negocio}}`.
- Seed no destructivo (lógica en `prisma/seed-runner.ts`): settings solo si no existe la fila; catálogo de ejemplo solo si no hay ninguna categoría; admin solo si no existe ninguno (sistema de un único admin). Nunca pisa ni recrea lo gestionado desde el panel.
- Orden público de servicios: primero por `sortOrder` de la categoría, luego por `sortOrder` del servicio y por nombre.
- Búsqueda pública (`q`): `contains` insensible a mayúsculas sobre `name` y `shortDescription`, con comodines LIKE escapados (`escapeLikePattern`). Distingue tildes ("termica" ≠ "térmica"); si molesta, evaluar la extensión `unaccent` más adelante.
- Tests de integración de la API contra `services_app_test` (se migra en `test/global-setup.ts` y se vacía con `resetDatabase`). Archivos en serie (`fileParallelism: false`).
- Respuestas públicas no paginadas envueltas en `{ data }`. Los montos `Decimal` se exponen como `number`.
- Exportación de clientes/trabajos: PDF + CSV.
- TypeScript 6.0 (typescript-eslint aún no soporta TS 7) y React Router 7 (React Router 8 exige Node ≥ 22.22).
- Restricciones CHECK escritas a mano en la migración `init` (Prisma no las modela): Settings fila única, `priceAmount` null ⇔ `QUOTE`, montos ≥ 0. Si una migración futura recrea esas tablas, hay que conservarlas.
- `NODE_ENV` es obligatoria (sin valor por defecto) para que producción nunca arranque en modo desarrollo.
- `/api/health/db` cachea el último ping exitoso durante 15 s (limita pings, pero no evita que alguien mantenga Neon despierto). **Pendiente Fase 7:** protegerlo o limitarlo antes de producción.
- Logs: los errores de Prisma se registran sin `message` (solo name/code/modelName), porque el mensaje puede incluir datos de clientes. `CLAUDE.md` está excluido de Prettier.
- Sitio público (Fase 3): rutas en español (`/`, `/servicios`, `/servicios/:slug`, `/contacto`); los filtros del listado viven en la URL (`?linea=desarrollo|servicio-tecnico&categoria=<slug>&q=`) y el front los normaliza con los límites de `@sch/shared` (`constraints.ts`) para no pedir nada que la API rechace con 400.
- Dependencias de la Fase 3: `react-markdown` (descripción de servicios; con `skipHtml`, sin imágenes y cargado con `lazy` solo en el detalle), `@fontsource-variable/inter` (fuente autoalojada, sin terceros), `jsdom` 29 + Testing Library (tests de componentes; jsdom 30+ exige Node ≥ 22.22).
- Modo claro/oscuro: sigue al sistema hasta que el visitante elige; el script inline de `index.html` aplica el tema antes del primer pintado. **Pendiente Fase 7:** permitirlo por hash en la CSP.
- Vite: no usar `loadEnv` sobre el `.env` raíz (su `NODE_ENV=development` forzaba un build de desarrollo); el puerto se lee con `parseEnv`. `@sch/shared` se resuelve por la condición `@sch/source` (cliente y SSR/Vitest) y declara `sideEffects: false`: lo que el front no importa (Zod) queda fuera del bundle. No importar `schemas.ts` desde el front.
- Títulos de pestaña con `usePageTitle` (`document.title`), sin `react-helmet-async`.
- "Sobre mí" de `/contacto` sale de `Settings.aboutText` (texto plano; párrafos separados por una línea en blanco). Si es null se muestra `DEFAULT_ABOUT_TEXT` (`apps/web/src/lib/about-text.ts`).
- Auditoría de seguridad previa a la Fase 4 (2026-11-18), **implementada en la Fase 4**. Decidido con el usuario:
  - **En la Fase 4:**
    - `trust proxy = 1` solo en producción.
    - Rate limit global en `/api`.
    - Caché corta de las respuestas públicas.
    - Se **quita `cors`** (y `CORS_ORIGIN`): front y API comparten origen. Como defensa CSRF, las escrituras de `/api/auth` y `/api/admin` exigen `Content-Type: application/json` y un header `Origin` permitido.
  - **Diseño de auth (checklist del auditor):**
    - JWT HS256 con `jose`; claims `sub` y `tv` (tokenVersion en `AdminUser`), sin email.
    - Vencimiento de 8-12 h con renovación deslizante y tope absoluto.
    - Cookie `httpOnly` + `SameSite=Strict`, `__Host-` en producción.
    - Login con mensaje genérico y hash ficticio para igualar tiempos.
    - Rate limit de fallos (login y contraseña actual): 10/h por IP, 10/h por dispositivo de confianza y 50/h global. El global no aplica a navegadores con cookie de "dispositivo de confianza": un JWT firmado con audiencia propia, `jti` y `tv`, de 90 días, que se emite en cada login correcto (patrón de OWASP). Así un ataque distribuido no bloquea al admin. Su límite propio impide la fuerza bruta con una cookie robada, y el `tv` la revoca al cambiar la contraseña o cerrar todas las sesiones.
    - `POST /api/admin/logout-all` (botón "Cerrar sesión en todos los dispositivos" en Configuración): `tokenVersion++`, invalida todas las sesiones y dispositivos de confianza. El logout normal solo borra la cookie de ese navegador.
    - `JWT_SECRET`: mínimo 43 caracteres y al menos 16 distintos (rechaza secretos armados a mano).
    - `redact` de body, email y contraseñas en el logger.
  - **Regla de logs:** ningún mensaje de error interpola datos de entrada.
  - Implementación: `GET /api/auth/me` responde `{ data: null }` (200) sin sesión, para que el front consulte el estado sin errores en consola; todo `/api/admin/*` responde 401 sin sesión (requireAuth antes del router, incluso en rutas inexistentes). Cambio de contraseña en `POST /api/admin/password` (comparte el limitador de intentos con el login). El panel (`/admin/*`) se carga con `lazy`: React Hook Form y Zod quedan fuera del bundle público. Limitadores en memoria (una sola instancia; se reinician al dormirse Render).
  - **Pendientes:**
    - Token para `/api/health/db` (Fase 7).
    - Verificar en el primer deploy (Fase 7) que con `trust proxy = 1` `req.ip` sea la IP real del visitante en Render (endpoint temporal) y anotar el resultado acá.
    - Evaluar con el usuario si las redes (Instagram, GitHub, LinkedIn) también deben pedir la contraseña al cambiarse: hoy solo WhatsApp y email (lo decidido). Sugerido por el code-reviewer (2026-11-21).
- Panel de catálogo (Fase 5):
  - API del panel en el mismo módulo que la pública (`create<X>AdminRouter` / `create<X>AdminController`), compuesta en `modules/admin/admin.routes.ts`. Cada escritura llama a `onPublicDataChange` → `publicCache.clear()`.
  - Escrituras parciales con `PATCH` (el formulario manda todo; la tabla, solo lo que cambia). En "a consultar" la API ignora el monto y guarda null. `priceUpdatedAt` cambia solo si cambian tipo, monto o moneda. Un servicio que cambia de categoría va al final de la nueva.
  - Borrado físico solo sin dependencias (servicio sin trabajos, categoría sin servicios; 409 si no): condición y borrado en un mismo `deleteMany`. Lo demás se archiva/oculta.
  - Reordenar = `PUT .../order` con la lista completa (de la categoría, para servicios); si no coincide con lo guardado, 409 `ORDER_MISMATCH`. En el front: botones subir/bajar con actualización optimista; en Servicios, solo filtrando por una categoría, sin búsqueda y en "Orden del sitio".
  - Actualización masiva: `applyPriceAdjustment` (`@sch/shared`, con `bigint`) corre igual en la vista previa y en la API; redondea siempre al entero (decisión del usuario). Todo o nada; un monto fijo exige una sola moneda; los "a consultar" se omiten.
  - Errores por campo de la API con el formato de Zod (`details: [{ path, message }]`, ver `fieldValidationError` / `slugTakenError`) para marcarlos en el formulario (`applyFieldErrors`).
  - Montos en inputs de texto con formato es-AR (`parseAmountInput`: "25.000", "1.500,50"). Número de WhatsApp: la API guarda solo dígitos; `whatsappNumberWarning` avisa (sin bloquear) celulares argentinos mal armados. Links de redes: solo `https:`.
  - Filtros del listado de servicios del panel en la URL (`?q=&categoria=<id>&estado=&orden=`), filtrado en el navegador (catálogo chico, sin paginar).
  - Dependencia: `sonner` (toasts, solo en el chunk del panel). Selects nativos (`ui/native-select.tsx`) en vez del Select de Radix.
  - `@sch/shared` no tiene tipos de Node ni DOM en su build: `URL` se declara localmente en `schemas.ts`.
  - Concurrencia y timeouts: las transacciones con un update por ítem usan `BATCH_TRANSACTION_OPTIONS` (20 s) y hasta `BULK_MAX_ITEMS` = 200. La actualización masiva escribe con guarda optimista (`updateMany` con el precio leído); si cambió, 409 `PRICE_CHANGED` y no guarda nada. P2025/P2003 en escrituras del panel → 404/400, no 500.
  - Tras editar desde la tabla (precio, destacar, archivar) se reemplaza la fila en la caché con la respuesta, sin refetch del listado: así editar precios uno por uno no se acerca al rate limit de `/api`.
  - Accesibilidad del panel: botones que guardan en línea o reordenan usan `aria-disabled` + guarda en el `onClick` (no `disabled`, que hace perder el foco); subir/bajar se anuncia en una región `aria-live`; tras borrar o archivar una fila que desaparece, el foco va a `#main` (`lib/focus.ts`). Avisos de error sobre fondo tintado con `text-destructive-text` (contraste AA).
  - Toasts arriba al centro (abajo están las barras de selección y de guardado); errores y "Deshacer" duran 10 s (`lib/notify.ts`). Formularios largos (servicio, Configuración) avisan al salir con cambios sin guardar (`useUnsavedChangesGuard`, con `useBlocker` + `beforeunload`).
  - Cambiar el número de WhatsApp o el email de Configuración exige la contraseña actual (decidido con el usuario tras la auditoría de la Fase 5): con una sesión ajena abierta se podrían desviar los contactos. `PUT /api/admin/settings` acepta `currentPassword` (`settingsUpdateSchema`); si el contacto cambia (`contactSettingsChanged`, sobre valores normalizados) y no viene, 403 `CURRENT_PASSWORD_REQUIRED`; si es incorrecta, 400 `INVALID_CURRENT_PASSWORD`. Los limitadores de intentos del login se aplican solo cuando el body trae contraseña (los errores de validación comunes no consumen cupo). Si el contacto no cambió, el upsert no reescribe WhatsApp ni email (`includeContact`): un guardado sin contraseña no puede revertir un cambio que otra petición hizo entre la lectura y la escritura. Sin fila previa (instalación sin seed) no se pide. Los intentos rechazados se registran como `contact_settings_change_denied`, sin valores. En el panel, un diálogo pide la contraseña al guardar. Un 403 solo llega si el contacto se cambió desde otro dispositivo (esta pestaña no lo tocó): ahí no se pide la contraseña (revertiría ese cambio), se toma el contacto recargado y se avisa para guardar de nuevo. El formulario no se bloquea mientras guarda (perdería el foco): tras guardar se muestra lo guardado y solo los campos editados durante el guardado quedan como pendientes.
- Dependencias con parche forzado: `pnpm-workspace.yaml` tiene `overrides: '@prisma/config>effect': '>=3.22.1 <4'` (ReDoS en `effect`, solo desarrollo). Quitarlo cuando Prisma traiga una versión corregida. `pnpm audit` limpio al 2026-11-21.
