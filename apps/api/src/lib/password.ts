import { hash, verify } from '@node-rs/argon2';

// argon2id con los parámetros por defecto de @node-rs/argon2 (m=19 MiB, t=2, p=1),
// que coinciden con el mínimo recomendado por OWASP.

export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export function verifyPassword(passwordHash: string, plain: string): Promise<boolean> {
  return verify(passwordHash, plain);
}
