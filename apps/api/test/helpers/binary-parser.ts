import type request from 'supertest';

/** Parser de supertest que deja el body como Buffer (descargas de archivos). */
export function binary(
  res: request.Response,
  callback: (error: Error | null, body: Buffer) => void,
): void {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}
