// Datos que deja `requireAuth` en `res.locals` para los handlers del panel.
declare global {
  namespace Express {
    interface Locals {
      admin?: { id: number; email: string };
    }
  }
}

export {};
