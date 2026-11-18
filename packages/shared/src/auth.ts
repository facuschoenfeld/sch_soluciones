// Contratos de autenticación del panel (un único admin).

/** Datos de la sesión que ve el front. Nunca incluye el token: viaja solo en la cookie. */
export interface AuthUser {
  email: string;
}
