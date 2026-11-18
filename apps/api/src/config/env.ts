import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// El `.env` vive en la raíz del monorepo (misma profundidad desde src/ y dist/).
// En producción no existe y las variables llegan desde el entorno de Render.
loadDotenv({ path: fileURLToPath(new URL('../../../../.env', import.meta.url)), quiet: true });

/** Un origen válido es exactamente `protocolo://host[:puerto]`, sin barra final ni ruta. */
function isExactOrigin(value: string): boolean {
  try {
    return new URL(value).origin === value;
  } catch {
    return false;
  }
}

const envSchema = z
  .object({
    // Obligatorio (sin valor por defecto): si producción arrancara como "development",
    // intentaría cargar pino-pretty, que es dependencia de desarrollo.
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\//, 'Debe ser una cadena de conexión de PostgreSQL'),
    // Orígenes desde los que se aceptan escrituras en /api/auth y /api/admin (defensa CSRF:
    // se compara con el header Origin). Lista separada por comas, ej. "http://localhost:5173".
    // En producción, la URL pública del sitio (mismo origen que la API).
    ALLOWED_ORIGINS: z
      .string()
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      )
      .pipe(
        z
          .array(
            z.string().refine(isExactOrigin, {
              message: 'Cada origen debe ser protocolo://host[:puerto], sin barra final',
            }),
          )
          .min(1, 'Debe indicar al menos un origen'),
      ),
    // Firma de las sesiones (HS256). 43 caracteres = 32 bytes en base64url, el mínimo para HS256.
    JWT_SECRET: z
      .string()
      .min(
        43,
        'JWT_SECRET debe tener al menos 43 caracteres (generalo con el comando de .env.example)',
      )
      .refine((value) => !value.startsWith('CAMBIAR'), 'JWT_SECRET sigue con el valor de ejemplo')
      // Un secreto aleatorio en base64url tiene decenas de caracteres distintos; uno armado a mano
      // ("aaaa…", "12341234…") no, y se podría adivinar para falsificar sesiones.
      .refine(
        (value) => new Set(value).size >= 16,
        'JWT_SECRET parece poco aleatorio (generalo con el comando de .env.example)',
      ),
    LOG_LEVEL: z
      .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
      .default('info'),
  })
  .refine(
    (env) =>
      env.NODE_ENV !== 'production' ||
      env.ALLOWED_ORIGINS.every((origin) => origin.startsWith('https://')),
    { path: ['ALLOWED_ORIGINS'], message: 'En producción los orígenes deben ser https://' },
  );

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    // Se corta el arranque: sin configuración válida la API no debe levantar.
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${issues}`);
  }
  return result.data;
}
