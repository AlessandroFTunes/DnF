import { z } from 'zod';

/**
 * Chaves ordenáveis mapeadas para o campo do PocketBase — também é a allowlist.
 * Aceita `chave` (crescente) ou `-chave` (decrescente).
 */
export function sortable<const K extends string>(columns: Record<K, string>, fallback: string) {
  const keys = Object.keys(columns) as K[];
  const values = keys.flatMap((key) => [key, `-${key}`]) as [`${K}` | `-${K}`, ...(`${K}` | `-${K}`)[]];
  const schema = z.enum(values);

  return {
    schema,
    orderBy(sort?: z.infer<typeof schema>): string {
      if (!sort) return fallback;
      const desc = sort.startsWith('-');
      const key = (desc ? sort.slice(1) : sort) as K;
      return `${desc ? '-' : ''}${columns[key]},id`;
    },
  };
}
