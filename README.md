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

## Sitio público

Con `pnpm dev` corriendo, el sitio queda en http://localhost:5173:

| Ruta               | Contenido                                                                         |
| ------------------ | --------------------------------------------------------------------------------- |
| `/`                | Inicio: hero, líneas de servicio, destacados, cómo funciona y CTA de WhatsApp     |
| `/servicios`       | Listado con buscador y filtros por línea y categoría (`?linea=&categoria=&q=`)    |
| `/servicios/:slug` | Detalle del servicio (descripción en markdown, precio, tiempo estimado, WhatsApp) |
| `/contacto`        | "Sobre mí", horarios, zona de atención y redes                                    |

Los botones de WhatsApp abren un diálogo con el mensaje pre-cargado desde las plantillas de la configuración. El visitante puede editarlo antes de abrir `wa.me`. Para probar el build de producción: `pnpm build` y luego `pnpm --filter @sch/web preview` (http://localhost:4173, con la API corriendo).

## Panel de administración

En http://localhost:5173/admin (redirige a `/admin/login` si no hay sesión). Se ingresa con el admin que creó `pnpm db:seed` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`). La contraseña se cambia desde **Configuración**; al cambiarla se cierran las sesiones abiertas en otros dispositivos. Desde ahí también podés cerrar la sesión en todos los dispositivos (por ejemplo, si perdiste el celular).

| Sección           | Qué se hace                                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Servicios**     | Buscar y filtrar (categoría, estado, orden); editar el precio en la tabla; destacar; archivar/restaurar; borrar (solo sin trabajos); reordenar (filtrando por categoría); alta y edición         |
| **Precios**       | Seleccioná servicios → **Actualizar precios**: +/- % o monto fijo, con vista previa antes/después. El resultado se redondea al entero                                                            |
| **Categorías**    | Crear, editar, subir/bajar, ocultar/mostrar (oculta también sus servicios) y borrar (solo sin servicios)                                                                                         |
| **Configuración** | Datos del negocio, textos del inicio, "Sobre mí", contacto, redes y las tres plantillas de WhatsApp (con vista previa); contraseña y sesiones. Cambiar el WhatsApp o el email pide tu contraseña |
| **Inicio**        | Ingresos del mes por moneda (trabajos terminados o entregados en el mes), saldo a cobrar, trabajos por estado, próximos turnos y últimos clientes                                                |
| **Clientes**      | Buscar (nombre, teléfono o email) y paginar; ficha con contacto, notas, total facturado y cobrado, historial de trabajos y "Escribir por WhatsApp"; borrar (solo sin trabajos); exportar PDF/CSV |
| **Trabajos**      | Filtrar (estado, cliente, servicio, fechas de ingreso, saldo a cobrar); alta desde el listado o la ficha; el servicio precarga título y total; estados, cobros, equipo y notas; exportar PDF/CSV |

Los cambios se ven en el sitio al recargar: cada escritura del panel descarta la caché pública.

Los datos de clientes son personales (Ley 25.326): solo se exponen en `/api/admin` y nunca se registran en los logs. Al registrar un trabajo con un servicio del catálogo se guarda una copia de su nombre y precio: cambiar o borrar el servicio después no altera el historial. El estado avanza libremente (se pueden saltear pasos); volver a un estado anterior pide confirmación y un trabajo entregado no se puede cancelar. Al terminar un trabajo se registra la fecha de terminado (la de ese día); si se reabre, se borra. Las exportaciones respetan los filtros del listado; el CSV usa `;` como separador (Excel en español).

La sesión es una cookie httpOnly (`SameSite=Strict`; en producción `Secure` con prefijo `__Host-`) que dura 12 h y se renueva sola con el uso, hasta un máximo de 7 días desde el login. Los intentos fallidos de login (y de contraseña actual) se limitan: 10 por hora por IP y 50 por hora en total. El límite total no se aplica a los navegadores donde ya iniciaste sesión, que reciben una cookie de dispositivo de confianza (con su propio límite de 10 por hora): un ataque distribuido no te deja afuera desde tu PC o tu celular. Cambiar `JWT_SECRET` cierra todas las sesiones.

## Tests

`pnpm test` necesita Postgres corriendo: los tests de integración de la API usan la base `services_app_test` (`TEST_DATABASE_URL`), que se migra automáticamente y se vacía en cada corrida. Por seguridad, el nombre de esa base debe terminar en `_test`. Los tests del front corren en jsdom y no necesitan la API.

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

Respuestas en JSON. Las no paginadas vienen como `{ data }`, y los errores como `{ error: { code, message, details? } }`. Todo `/api/admin/*` responde 401 sin sesión. Las escrituras en `/api/auth` y `/api/admin` exigen `Content-Type: application/json` y un `Origin` incluido en `ALLOWED_ORIGINS` (defensa CSRF). Hay un límite global de 300 peticiones cada 15 minutos por IP (salvo `/api/health`), y las respuestas públicas se cachean 30 s en memoria.

| Endpoint                         | Descripción                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `GET /api/health`                | 200 sin consultar la base. Lo usará el monitor externo para evitar el arranque en frío.                |
| `GET /api/health/db`             | Verifica la conexión a PostgreSQL (503 si no está disponible).                                         |
| `GET /api/public/settings`       | Datos públicos del negocio y plantillas de WhatsApp (reserva, consulta y general).                     |
| `GET /api/public/categories`     | Categorías activas, ordenadas.                                                                         |
| `GET /api/public/services`       | Servicios activos. Filtros opcionales: `?category=<slug>` y `?q=<texto>` (nombre o descripción corta). |
| `GET /api/public/services/:slug` | Detalle de un servicio activo (incluye la descripción en markdown).                                    |
| `POST /api/auth/login`           | Inicia sesión (`{ email, password }`) y deja la cookie de sesión.                                      |
| `POST /api/auth/logout`          | Cierra la sesión (borra la cookie).                                                                    |
| `GET /api/auth/me`               | Admin de la sesión (`{ data: { email } }`), o `{ data: null }` sin sesión.                             |
| `POST /api/admin/password`       | Cambia la contraseña (`{ currentPassword, newPassword }`). Requiere sesión.                            |
| `POST /api/admin/logout-all`     | Cierra la sesión en todos los dispositivos (incluido el actual). Requiere sesión.                      |

Panel (todo requiere sesión; las altas responden 201, los borrados y reordenamientos 204):

| Endpoint                                   | Descripción                                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `GET/POST /api/admin/categories`           | Lista (con cantidad de servicios) / alta.                                                                                 |
| `PATCH/DELETE /api/admin/categories/:id`   | Edición parcial / borrado (409 `CATEGORY_HAS_SERVICES` si tiene servicios).                                               |
| `PUT /api/admin/categories/order`          | `{ ids }` con todas las categorías en el orden nuevo.                                                                     |
| `GET/POST /api/admin/services`             | Lista completa (activos y archivados, con cantidad de trabajos) / alta.                                                   |
| `GET/PATCH/DELETE /api/admin/services/:id` | Detalle / edición parcial (archivar = `{ isActive: false }`) / borrado (409 `SERVICE_HAS_JOBS` si tiene trabajos).        |
| `PUT /api/admin/services/order`            | `{ categoryId, ids }` con todos los servicios de la categoría en el orden nuevo.                                          |
| `POST /api/admin/services/bulk-price`      | `{ serviceIds, adjustment: { kind, value } }` (`PERCENT` o `AMOUNT`). Todo o nada; omite los "a consultar".               |
| `GET/PUT /api/admin/settings`              | Configuración del negocio (el PUT reemplaza todos los campos; si cambia el WhatsApp o el email, exige `currentPassword`). |
| `GET/POST /api/admin/clients`              | Lista paginada (`?q=&page=&pageSize=`, por nombre, email o dígitos del teléfono) / alta.                                  |
| `GET/PATCH/DELETE /api/admin/clients/:id`  | Ficha (con totales por moneda) / edición parcial / borrado (409 `CLIENT_HAS_JOBS` si tiene trabajos).                     |
| `GET /api/admin/clients/export`            | `?format=pdf\|csv&q=`: descarga el listado filtrado.                                                                      |
| `GET/POST /api/admin/jobs`                 | Lista paginada (`?status=&clientId=&serviceId=&from=&to=&balanceDue=true`; fechas `AAAA-MM-DD` en hora argentina) / alta. |
| `GET/PATCH/DELETE /api/admin/jobs/:id`     | Detalle / edición parcial (409 `JOB_CHANGED` si otra petición lo modificó en el medio) / borrado.                         |
| `GET /api/admin/jobs/export`               | `?format=pdf\|csv` y los mismos filtros del listado.                                                                      |
| `GET /api/admin/dashboard`                 | Métricas del inicio del panel.                                                                                            |

## Variables de entorno

Ver [`.env.example`](.env.example). Hay un único `.env` en la raíz del repo y nunca se commitea.
