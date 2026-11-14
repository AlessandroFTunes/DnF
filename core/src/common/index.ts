import type { RecordModel } from 'pocketbase';
import { z } from 'zod';
import { PocketBase, sortable } from '../pocketbase';

export namespace Common {
  export const IdDescription = 'Unique identifier.';

  /** Parâmetros de listagem paginada + filtros específicos de cada módulo. */
  export function Query<S extends z.ZodRawShape>(shape: S) {
    return z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
      ...shape,
    });
  }

  export interface Page<T> {
    data: T[];
    page: number;
    pageSize: number;
    total: number;
  }

  /**
   * Listagem paginada de uma coleção do PocketBase. `columns` diz o que cada chave de ordenação ordena (também é a
   * allowlist) e `fallback` é a ordem padrão. `Query` é o schema da entrada (página, ordem e busca por nome); `page`
   * lista, com `where` (filtros do PocketBase) restringindo o que entra.
   */
  export function listing<const K extends string, T>(spec: {
    collection: string;
    columns: Record<K, string>;
    fallback: string;
    serialize: (record: RecordModel) => T;
  }) {
    const sort = sortable(spec.columns, spec.fallback);
    const Input = Query({ sort: sort.schema.optional(), search: z.string().optional() });
    return {
      Query: Input,
      async page(input: z.output<typeof Input>, where: string[] = []): Promise<Page<T>> {
        const pb = PocketBase.use();
        const filter = input.search ? [...where, pb.filter('name ~ {:search}', { search: input.search })] : where;
        const result = await pb.collection(spec.collection).getList(input.page, input.pageSize, {
          filter: filter.join(' && '),
          sort: sort.orderBy(input.sort),
        });
        return { data: result.items.map(spec.serialize), page: result.page, pageSize: result.perPage, total: result.totalItems };
      },
    };
  }

  /** O PocketBase grava datas como "2026-10-04 05:24:30.227Z"; converte para ISO 8601. */
  export function toISO(date: string): string {
    return new Date(date.replace(' ', 'T')).toISOString();
  }
}
