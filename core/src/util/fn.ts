import type { z } from 'zod';

export interface FnMeta {
  title: string;
  description: string;
}

/**
 * Função assíncrona com entrada validada pelo Zod.
 * `fn(input)` valida; `fn.force(input)` pula a validação (chamadas internas com dados já confiáveis).
 * Sempre retorna Promise: erro de validação vira rejeição, então `.catch()` pega tudo.
 */
export function fn<S extends z.ZodType, R>(
  schema: S,
  handler: (input: z.output<S>) => R,
  meta?: FnMeta,
) {
  const wrapped = async (input: z.input<S>): Promise<Awaited<R>> => await handler(schema.parse(input));
  wrapped.force = async (input: z.output<S>): Promise<Awaited<R>> => await handler(input);
  wrapped.schema = schema;
  wrapped.meta = meta;
  return wrapped;
}
